import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;

/// Zenova AI Service powered by Groq (free cloud API)
/// Uses Llama 3.3 for chat and Llama 4 Scout for vision/report analysis
/// Get your free API key at: https://console.groq.com/keys
class AiService {
  static String _apiKey = '';
  static String _chatModel = 'llama-3.3-70b-versatile';
  static String _visionModel = 'meta-llama/llama-4-scout-17b-16e-instruct';
  static const String _baseUrl = 'https://api.groq.com/openai/v1';

  /// Set the Groq API key
  static void setApiKey(String key) => _apiKey = key.trim();

  /// Check if API key is configured
  static bool get isConfigured => _apiKey.isNotEmpty;

  /// Get masked key for display
  static String get maskedKey {
    if (_apiKey.isEmpty) return '';
    if (_apiKey.length <= 8) return '••••••••';
    return '${_apiKey.substring(0, 4)}••••${_apiKey.substring(_apiKey.length - 4)}';
  }

  /// Getters
  static String get chatModel => _chatModel;
  static String get visionModel => _visionModel;

  /// Set models
  static void setChatModel(String model) => _chatModel = model.trim();
  static void setVisionModel(String model) => _visionModel = model.trim();

  // ─── Report Analysis ─────────────────────────────────────────────────

  /// Analyze a medical report image using Groq Vision model
  static Future<Map<String, dynamic>> analyzeReport({
    required Uint8List imageBytes,
    required String mimeType,
    String reportType = 'general',
    String audience = 'patient', // 'patient' or 'doctor'
  }) async {
    if (!isConfigured) {
      throw Exception(
          'Groq API key not set. Add GROQ_API_KEY to the .env file.');
    }

    final base64Image = base64Encode(imageBytes);
    final dataUri = 'data:$mimeType;base64,$base64Image';

    // Different prompts based on audience
    String instructions;
    if (audience == 'doctor') {
      instructions = '''
Return your analysis as a single JSON object (NOT an array). Use this EXACT format:
{
  "reportTitle": "Clinical Report Title",
  "dateDetected": "Date or Not detected",
  "parameters": [
    {
      "name": "Standardized Test Name",
      "value": "Exact value",
      "unit": "Unit",
      "referenceRange": "Reference Range",
      "status": "normal/high/low/critical",
      "riskLevel": 1
    }
  ],
  "patientSummary": {
    "overview": "Brief patient-friendly summary.",
    "keyFindings": ["Finding 1"],
    "riskIndicators": [],
    "nextSteps": [],
    "reassurance": ""
  },
  "doctorSummary": {
    "clinicalOverview": "Detailed clinical synthesis using standard medical terminology. Focus on pathophysiology and clinical significance.",
    "abnormalities": ["Specific abnormality with magnitude and clinical implication"],
    "differentialConsiderations": ["List 3-5 potential differential diagnoses based on these findings"],
    "suggestedFollowUp": ["Specific diagnostic tests or clinical correlations recommended"],
    "trendNotes": "Observations on value consistency or acute/chronic indications",
    "clinicalCorrelation": "Notes on potential multisystem involvement"
  }
}
IMPORTANT:
- Maintain HIGH clinical accuracy.
- Use standard medical terminology (e.g., 'Leukocytosis' instead of 'high white blood cells').
- Provide a robust differential diagnosis in 'differentialConsiderations'.
''';
    } else {
      instructions = '''
Return your analysis as a single JSON object (NOT an array). Use this EXACT format:
{
  "reportTitle": "Report Title",
  "dateDetected": "Date",
  "parameters": [...],
  "patientSummary": {
    "overview": "Simple explanation for non-medical person.",
    "keyFindings": ["Simple finding"],
    "riskIndicators": [{"label": "Concern", "level": "low/high", "explanation": "Why"}],
    "nextSteps": ["Simple action items"],
    "reassurance": "Calming message"
  },
  "doctorSummary": {
    "clinicalOverview": "Technical summary",
    "abnormalities": [],
    "differentialConsiderations": [],
    "suggestedFollowUp": [],
    "trendNotes": "",
    "clinicalCorrelation": ""
  }
}
IMPORTANT:
- Use SIMPLE everyday language for patientSummary.
- Be reassuring and clear.
''';
    }

    final prompt = '''
Look at this medical report image carefully. Read every value and parameter shown.
$instructions
- Return ONLY the JSON object.
- Do NOT wrap in markdown code blocks.
''';

    final body = jsonEncode({
      'model': _visionModel,
      'messages': [
        {
          'role': 'system',
          'content':
              'You are a high-precision medical AI assistant. You analyze medical documents with extreme attention to detail.',
        },
        {
          'role': 'user',
          'content': [
            {'type': 'text', 'text': prompt},
            {
              'type': 'image_url',
              'image_url': {'url': dataUri},
            },
          ],
        }
      ],
      'temperature': 0.1, // Lower temperature for higher accuracy
      'max_tokens': 4096,
    });

    final response = await http
        .post(
          Uri.parse('$_baseUrl/chat/completions'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $_apiKey',
          },
          body: body,
        )
        .timeout(const Duration(seconds: 90));

    if (response.statusCode == 401) {
      throw Exception(
          'Invalid API key. Check GROQ_API_KEY in your .env file.');
    }

    if (response.statusCode != 200) {
      final errMsg = _parseError(response.body);
      throw Exception('Analysis failed: $errMsg');
    }

    final result = jsonDecode(response.body);
    final text = result['choices']?[0]?['message']?['content'] ?? '';

    return _extractAnalysisJson(text);
  }

  /// Robustly extract JSON from AI response text
  static Map<String, dynamic> _extractAnalysisJson(String text) {
    String jsonStr = text.trim();

    // Step 1: Remove markdown code block wrapping
    if (jsonStr.contains('```')) {
      final match =
          RegExp(r'```(?:json)?\s*([\s\S]*?)\s*```').firstMatch(jsonStr);
      if (match != null) {
        jsonStr = match.group(1)!.trim();
      }
    }

    // Step 2: Try to find JSON object {...} in the text
    final objectMatch = RegExp(r'\{[\s\S]*\}').firstMatch(jsonStr);
    if (objectMatch != null) {
      jsonStr = objectMatch.group(0)!;
    }

    // Step 3: Try parsing
    try {
      final decoded = jsonDecode(jsonStr);

      // If it decoded as a List, take the first element
      if (decoded is List && decoded.isNotEmpty) {
        final first = decoded.first;
        if (first is Map<String, dynamic>) {
          return first;
        }
      }

      // If it decoded as a Map, return directly
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
    } catch (_) {
      // JSON parsing failed — continue to fallback
    }

    // Step 4: Fallback — return readable summary
    String cleanText = text
        .replaceAll(RegExp(r'```(?:json)?'), '')
        .replaceAll('```', '')
        .trim();

    if (cleanText.isEmpty) {
      cleanText =
          'Report analysis completed. Please consult your doctor for detailed interpretation.';
    }

    return {
      'reportTitle': 'Medical Report Analysis',
      'patientSummary': {
        'overview': cleanText.length > 500
            ? cleanText.substring(0, 500)
            : cleanText,
        'keyFindings': <String>[
          'Analysis completed — see overview above for details'
        ],
        'riskIndicators': <Map<String, dynamic>>[],
        'nextSteps': <String>['Discuss these results with your doctor'],
        'reassurance':
            'This is an AI-assisted summary. Your doctor will give you the most accurate advice.',
      },
      'doctorSummary': {
        'clinicalOverview': text,
        'abnormalities': <String>[],
        'differentialConsiderations': <String>[],
        'suggestedFollowUp': <String>[],
        'trendNotes': '',
        'clinicalCorrelation': '',
      },
      'parameters': <Map<String, dynamic>>[],
    };
  }

  // ─── Chat / Conversational AI ──────────────────────────────────────

  /// Send a chat message via Groq
  static Future<String> chat({
    required String message,
    List<Map<String, String>> history = const [],
    String? userLanguage,
  }) async {
    if (!isConfigured) {
      throw Exception(
          'Groq API key not set. Add GROQ_API_KEY to the .env file.');
    }

    final systemPrompt = '''
You are Zenova AI, a compassionate, knowledgeable healthcare assistant designed for patients in India. Your advice should be relevant to the Indian healthcare system. Your role:

1. MEDICAL ACCURACY: Provide medically accurate information while always noting you're not a replacement for professional medical advice.

2. SENTIMENT AWARENESS: Detect emotional cues in the user's messages. If they seem anxious, stressed, or scared about health issues, adapt your tone to be extra reassuring and calming while remaining truthful.

3. PLAIN LANGUAGE: Explain medical concepts in simple, easy-to-understand terms. Avoid jargon unless the user seems medically literate.

4. MULTILINGUAL: Respond in the same language the user writes in.${userLanguage != null ? ' The user prefers $userLanguage.' : ''}

5. SCOPE: You can discuss general health topics, explain medical terms, interpret common lab values, suggest when to see a doctor, and provide wellness tips. Never diagnose conditions or prescribe treatments.

6. EMOTIONAL SUPPORT: If a user seems distressed about a diagnosis or health concern, acknowledge their feelings first before providing information.

Always end with a supportive note when discussing concerning health topics.
''';

    final messages = <Map<String, String>>[];
    messages.add({'role': 'system', 'content': systemPrompt});

    for (final msg in history) {
      final role = msg['role'];
      if (role == 'system') {
        messages.add({'role': 'system', 'content': msg['content'] ?? ''});
      } else {
        messages.add({
          'role': role == 'user' ? 'user' : 'assistant',
          'content': msg['content'] ?? '',
        });
      }
    }

    messages.add({'role': 'user', 'content': message});

    final body = jsonEncode({
      'model': _chatModel,
      'messages': messages,
      'temperature': 0.7,
      'max_tokens': 2048,
    });

    final response = await http
        .post(
          Uri.parse('$_baseUrl/chat/completions'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $_apiKey',
          },
          body: body,
        )
        .timeout(const Duration(seconds: 30));

    if (response.statusCode == 401) {
      throw Exception(
          'Invalid API key. Check GROQ_API_KEY in your .env file.');
    }

    if (response.statusCode != 200) {
      final errMsg = _parseError(response.body);
      throw Exception('Chat failed: $errMsg');
    }

    final result = jsonDecode(response.body);
    return result['choices']?[0]?['message']?['content'] ??
        'I apologize, but I couldn\'t generate a response. Please try again.';
  }

  // ─── Insurance Recommendation ──────────────────────────────────────

  /// Get AI insurance recommendations via Groq
  static Future<String> getInsuranceRecommendation({
    required String medicalProfile,
    required String currentCoverage,
    String budget = '',
  }) async {
    if (!isConfigured) {
      throw Exception(
          'Groq API key not set. Add GROQ_API_KEY to the .env file.');
    }

    final prompt = '''
You are an AI insurance advisor for the Zenova healthcare platform in India. Based on the following patient profile, provide personalized insurance optimization recommendations relevant to the Indian market.

PATIENT PROFILE:
$medicalProfile

CURRENT COVERAGE:
$currentCoverage

${budget.isNotEmpty ? 'BUDGET: $budget' : ''}

Provide recommendations in a clear, structured format:
1. **Coverage Gap Analysis**: Identify what's not covered that should be
2. **Plan Recommendations**: Suggest 2-3 specific plan types with pros/cons
3. **Cost Optimization**: Ways to reduce premiums without losing important coverage
4. **Risk Assessment**: Based on the medical profile, what coverages are most critical
5. **Action Items**: Specific steps the patient should take

Keep the language friendly and accessible. Remember to note that final decisions should be discussed with a licensed insurance professional.
''';

    final body = jsonEncode({
      'model': _chatModel,
      'messages': [
        {
          'role': 'system',
          'content': 'You are a helpful insurance advisor.'
        },
        {'role': 'user', 'content': prompt},
      ],
      'temperature': 0.5,
      'max_tokens': 2048,
    });

    final response = await http
        .post(
          Uri.parse('$_baseUrl/chat/completions'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $_apiKey',
          },
          body: body,
        )
        .timeout(const Duration(seconds: 30));

    if (response.statusCode == 401) {
      throw Exception(
          'Invalid API key. Check GROQ_API_KEY in your .env file.');
    }

    if (response.statusCode != 200) {
      final errMsg = _parseError(response.body);
      throw Exception('Recommendation failed: $errMsg');
    }

    final result = jsonDecode(response.body);
    return result['choices']?[0]?['message']?['content'] ??
        'Unable to generate recommendations at this time.';
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  static String _parseError(String responseBody) {
    try {
      final err = jsonDecode(responseBody);
      return err['error']?['message'] ??
          'Unknown error (${responseBody.substring(0, 100)})';
    } catch (e) {
      return responseBody.length > 150
          ? responseBody.substring(0, 150)
          : responseBody;
    }
  }
}
