import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;

class GeminiService {
  static String _apiKey = '';
  static const String _modelId = 'gemini-2.0-flash';
  static const String _baseUrl =
      'https://generativelanguage.googleapis.com/v1beta/models';

  /// Set the Gemini API key at runtime
  static void setApiKey(String key) {
    _apiKey = key.trim();
  }

  /// Check if API key is configured
  static bool get isConfigured => _apiKey.isNotEmpty;

  /// Get current API key (masked)
  static String get maskedKey {
    if (_apiKey.isEmpty) return '';
    if (_apiKey.length <= 8) return '****';
    return '${_apiKey.substring(0, 4)}...${_apiKey.substring(_apiKey.length - 4)}';
  }

  // ─── Report Analysis ─────────────────────────────────────────────────

  /// Analyze a medical report image and return dual outputs
  static Future<Map<String, dynamic>> analyzeReport({
    required Uint8List imageBytes,
    required String mimeType,
    String reportType = 'general',
  }) async {
    if (!isConfigured) {
      throw Exception('Gemini API key not configured. Please set it in Settings.');
    }

    final base64Image = base64Encode(imageBytes);

    final prompt = '''
You are an advanced medical report analysis AI. Analyze the uploaded medical report image thoroughly.

Generate TWO separate analyses in the following JSON format (return ONLY valid JSON, no markdown):
{
  "reportTitle": "Name/type of the report",
  "dateDetected": "Date on the report if visible, otherwise 'Not detected'",
  "parameters": [
    {
      "name": "Parameter name",
      "value": "Detected value",
      "unit": "Unit of measurement",
      "referenceRange": "Normal reference range",
      "status": "normal|high|low|critical",
      "riskLevel": 1-5
    }
  ],
  "patientSummary": {
    "overview": "Plain language explanation of results (2-3 sentences)",
    "keyFindings": ["Finding 1 in simple terms", "Finding 2"],
    "riskIndicators": [
      {"label": "Risk area", "level": "low|moderate|high|critical", "explanation": "Simple explanation"}
    ],
    "nextSteps": ["Actionable step 1", "Step 2"],
    "reassurance": "A calming note about the results if appropriate"
  },
  "doctorSummary": {
    "clinicalOverview": "Technical clinical summary",
    "abnormalities": ["Abnormality 1 with clinical significance", "Abnormality 2"],
    "differentialConsiderations": ["Consideration 1", "Consideration 2"],
    "suggestedFollowUp": ["Follow-up test 1", "Follow-up test 2"],
    "trendNotes": "Notes about trends if historical data is visible",
    "clinicalCorrelation": "Suggested clinical correlation notes"
  }
}
''';

    final body = jsonEncode({
      'contents': [
        {
          'parts': [
            {'text': prompt},
            {
              'inlineData': {
                'mimeType': mimeType,
                'data': base64Image,
              }
            }
          ]
        }
      ],
      'generationConfig': {
        'temperature': 0.3,
        'topP': 0.8,
        'maxOutputTokens': 4096,
      }
    });

    final response = await http.post(
      Uri.parse('$_baseUrl/$_modelId:generateContent?key=$_apiKey'),
      headers: {'Content-Type': 'application/json'},
      body: body,
    );

    if (response.statusCode != 200) {
      final error = jsonDecode(response.body);
      throw Exception(
          error['error']?['message'] ?? 'Failed to analyze report (${response.statusCode})');
    }

    final result = jsonDecode(response.body);
    final text = result['candidates']?[0]?['content']?['parts']?[0]?['text'] ?? '';

    String jsonStr = text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replaceAll(RegExp(r'^```json?\n?'), '').replaceAll(RegExp(r'\n?```$'), '');
    }

    try {
      return jsonDecode(jsonStr) as Map<String, dynamic>;
    } catch (e) {
      // If JSON parsing fails, return raw text in a structured format
      return {
        'reportTitle': 'Medical Report Analysis',
        'patientSummary': {
          'overview': text,
          'keyFindings': [],
          'riskIndicators': [],
          'nextSteps': [],
          'reassurance': '',
        },
        'doctorSummary': {
          'clinicalOverview': text,
          'abnormalities': [],
          'differentialConsiderations': [],
          'suggestedFollowUp': [],
          'trendNotes': '',
          'clinicalCorrelation': '',
        },
        'parameters': [],
      };
    }
  }

  // ─── Chat / Conversational AI ──────────────────────────────────────

  /// Send a chat message with conversation history
  static Future<String> chat({
    required String message,
    List<Map<String, String>> history = const [],
    String? userLanguage,
  }) async {
    if (!isConfigured) {
      throw Exception('Gemini API key not configured. Please set it in Settings.');
    }

    final systemPrompt = '''
You are Zenova AI, a compassionate, knowledgeable healthcare assistant. Your role:

1. MEDICAL ACCURACY: Provide medically accurate information while always noting you're not a replacement for professional medical advice.

2. SENTIMENT AWARENESS: Detect emotional cues in the user's messages. If they seem anxious, stressed, or scared about health issues, adapt your tone to be extra reassuring and calming while remaining truthful.

3. PLAIN LANGUAGE: Explain medical concepts in simple, easy-to-understand terms. Avoid jargon unless the user seems medically literate.

4. MULTILINGUAL: Respond in the same language the user writes in.${userLanguage != null ? ' The user prefers $userLanguage.' : ''}

5. SCOPE: You can discuss general health topics, explain medical terms, interpret common lab values, suggest when to see a doctor, and provide wellness tips. Never diagnose conditions or prescribe treatments.

6. EMOTIONAL SUPPORT: If a user seems distressed about a diagnosis or health concern, acknowledge their feelings first before providing information.

Always end with a supportive note when discussing concerning health topics.

IMPORTANT: You are part of Zenova, a secure digital healthcare platform. Patient data is encrypted with AES-256 and never shared without consent.
''';

    // Build conversation contents
    final contents = <Map<String, dynamic>>[];

    // Add system context as first message
    contents.add({
      'role': 'user',
      'parts': [
        {'text': 'System: $systemPrompt'}
      ]
    });
    contents.add({
      'role': 'model',
      'parts': [
        {
          'text':
              'I understand my role as Zenova AI. I\'m ready to help with healthcare questions with empathy, accuracy, and clarity.'
        }
      ]
    });

    // Add conversation history
    for (final msg in history) {
      contents.add({
        'role': msg['role'] == 'user' ? 'user' : 'model',
        'parts': [
          {'text': msg['content'] ?? ''}
        ]
      });
    }

    // Add current message
    contents.add({
      'role': 'user',
      'parts': [
        {'text': message}
      ]
    });

    final body = jsonEncode({
      'contents': contents,
      'generationConfig': {
        'temperature': 0.7,
        'topP': 0.9,
        'maxOutputTokens': 2048,
      }
    });

    final response = await http.post(
      Uri.parse('$_baseUrl/$_modelId:generateContent?key=$_apiKey'),
      headers: {'Content-Type': 'application/json'},
      body: body,
    );

    if (response.statusCode != 200) {
      final error = jsonDecode(response.body);
      throw Exception(
          error['error']?['message'] ?? 'Chat failed (${response.statusCode})');
    }

    final result = jsonDecode(response.body);
    return result['candidates']?[0]?['content']?['parts']?[0]?['text'] ??
        'I apologize, but I couldn\'t generate a response. Please try again.';
  }

  // ─── Insurance Recommendation ──────────────────────────────────────

  /// Get AI-powered insurance plan recommendations
  static Future<String> getInsuranceRecommendation({
    required String medicalProfile,
    required String currentCoverage,
    String budget = '',
  }) async {
    if (!isConfigured) {
      throw Exception('Gemini API key not configured. Please set it in Settings.');
    }

    final prompt = '''
You are an AI insurance advisor for the Zenova healthcare platform. Based on the following patient profile, provide personalized insurance optimization recommendations.

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
      'contents': [
        {
          'parts': [
            {'text': prompt}
          ]
        }
      ],
      'generationConfig': {
        'temperature': 0.5,
        'topP': 0.85,
        'maxOutputTokens': 2048,
      }
    });

    final response = await http.post(
      Uri.parse('$_baseUrl/$_modelId:generateContent?key=$_apiKey'),
      headers: {'Content-Type': 'application/json'},
      body: body,
    );

    if (response.statusCode != 200) {
      final error = jsonDecode(response.body);
      throw Exception(
          error['error']?['message'] ?? 'Recommendation failed (${response.statusCode})');
    }

    final result = jsonDecode(response.body);
    return result['candidates']?[0]?['content']?['parts']?[0]?['text'] ??
        'Unable to generate recommendations at this time.';
  }
}
