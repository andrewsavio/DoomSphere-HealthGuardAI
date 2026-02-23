import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Service to handle medical data storage and retrieval via Supabase
class MedicalDataService {
  static final _supabase = Supabase.instance.client;

  /// Save a new medical report to Supabase
  static Future<void> saveReport({
    required String title,
    required Map<String, dynamic> analysisResult,
    String? doctorName,
  }) async {
    final user = _supabase.auth.currentUser;
    if (user == null) throw Exception('User not authenticated');

    // Extract summary from analysis
    String summary = '';
    final patientSummary = analysisResult['patientSummary'];
    if (patientSummary != null && patientSummary['overview'] != null) {
      summary = patientSummary['overview'];
    } else {
      summary = 'Analysis completed on ${DateFormat('d MMM, yyyy').format(DateTime.now())}';
    }

    // safely extract status based on risk indicators
    String status = 'normal';
    final risks = analysisResult['patientSummary']?['riskIndicators'] as List?;
    if (risks != null && risks.isNotEmpty) {
      bool hasHighRisk = risks.any((r) => r['level'].toString().toLowerCase().contains('high'));
      bool hasModRisk = risks.any((r) => r['level'].toString().toLowerCase().contains('moderate'));
      
      if (hasHighRisk) status = 'critical';
      else if (hasModRisk) status = 'attention';
    }

    try {
      await _supabase.from('medical_history').insert({
        'user_id': user.id,
        'title': title.isNotEmpty ? title : 'Medical Report',
        'date': DateTime.now().toIso8601String(),
        'doctor': doctorName ?? 'Zenova AI Analysis',
        'summary': summary,
        'type': 'report',
        'status': status,
        'full_analysis': analysisResult,
      });
      debugPrint('Report saved to Supabase: $title');
    } catch (e) {
      debugPrint('Error saving report: $e');
      rethrow;
    }
  }

  /// Get medical history for the current authenticated user
  static Future<List<Map<String, dynamic>>> getHistory() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return [];

    try {
      final response = await _supabase
          .from('medical_history')
          .select()
          .eq('user_id', user.id)
          .order('date', ascending: false);
      
      // Convert date string to DateTime object for the UI
      return List<Map<String, dynamic>>.from(response).map((item) {
        // Create a modifiable copy of the map
        final map = Map<String, dynamic>.from(item);
        if (map['date'] is String) {
          map['date'] = DateTime.parse(map['date']);
        }
        return map;
      }).toList();
    } catch (e) {
      debugPrint('Error fetching history: $e');
      return [];
    }
  }

  /// Generate a context string for the Chatbot based on history
  static Future<String> getMedicalContextForChat() async {
    final history = await getHistory();
    
    if (history.isEmpty) return "Patient has no recorded medical history.";

    StringBuffer context = StringBuffer();
    context.writeln("PATIENT MEDICAL HISTORY SUMMARY:");
    
    // Take recent 5 records to avoid token limit overflow
    final recentRecords = history.take(5);
    
    for (final record in recentRecords) {
      final date = DateFormat('d MMM yyyy').format(record['date']);
      context.writeln("- $date: [${record['title']}] (${record['status']})");
      context.writeln("  Summary: ${record['summary']}");
      
      // Add specific parameters if available
      if (record['full_analysis'] != null && record['full_analysis']['parameters'] != null) {
        final params = record['full_analysis']['parameters'] as List;
        if (params.isNotEmpty) {
           context.write("  Key Values: ");
           final abnormalParams = params.where((p) => p['status'] != 'normal').take(3);
           if (abnormalParams.isNotEmpty) {
             for (final p in abnormalParams) {
               context.write("${p['name']}: ${p['value']} ${p['unit']} (${p['status']}), ");
             }
           } else {
             // If all normal, show first 2
             final someParams = params.take(2);
             for (final p in someParams) {
               context.write("${p['name']}: ${p['value']} ${p['unit']}, ");
             }
           }
           context.writeln("");
        }
      }
      context.writeln("");
    }
    
    return context.toString();
  }
}
