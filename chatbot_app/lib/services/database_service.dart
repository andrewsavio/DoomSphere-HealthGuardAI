
import 'package:supabase_flutter/supabase_flutter.dart';

class DatabaseService {
  final SupabaseClient _client = Supabase.instance.client;

  /// Get the current user's ID
  String? get currentUserId => _client.auth.currentUser?.id;

  // ─── Doctor Methods ───

  /// Fetch stats for a doctor's dashboard
  Future<Map<String, dynamic>> getDoctorStats(String doctorId) async {
    try {
      final response = await _client
          .from('doctor_stats')
          .select()
          .eq('doctor_id', doctorId)
          .maybeSingle();

      if (response == null) {
        return {
          'patients_count': 0,
          'appointments_count': 0,
          'rating': 5.0,
        };
      }
      return response;
    } catch (e) {
      // Return default stats if none found or error
      return {
        'patients_count': 0,
        'appointments_count': 0,
        'rating': 5.0,
      };
    }
  }

  /// Get list of patients assigned to a doctor
  Future<List<Map<String, dynamic>>> getPatientsForDoctor(String doctorId) async {
    try {
      // Join assignments with profiles and medical data
      final response = await _client
          .from('assignments')
          .select('*, profiles:patient_id(*, patient_medical_data(*))')
          .eq('doctor_id', doctorId)
          .order('assigned_at', ascending: false);
      
      return List<Map<String, dynamic>>.from(response);
    } catch (e) {
      // debugPrint('Error fetching patients: $e');
      return [];
    }
  }

  // ─── Patient Methods ───

  /// Get the assigned doctor for a patient
  Future<Map<String, dynamic>?> getAssignedDoctor(String patientId) async {
    try {
      final response = await _client
          .from('assignments')
          .select('*, profiles:doctor_id(*)') // Join with doctor's profile
          .eq('patient_id', patientId)
          .limit(1)
          .maybeSingle();
      
      if (response != null && response['profiles'] != null) {
        return response['profiles'] as Map<String, dynamic>;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /// Get patient's own medical snapshot
  Future<Map<String, dynamic>?> getMedicalSnapshot(String patientId) async {
    try {
      final response = await _client
          .from('patient_medical_data')
          .select()
          .eq('patient_id', patientId)
          .maybeSingle();
      return response;
    } catch (e) {
      return null;
    }
  }

  // ─── Common Methods ───

  /// Create or Update user profile (useful if Auth trigger fails or for manual updates)
  Future<void> updateProfile({
    required String uid,
    String? fullName,
    String? phone,
    String? avatarUrl,
  }) async {
    final updates = <String, dynamic>{
      'id': uid,
      'updated_at': DateTime.now().toIso8601String(),
    };
    if (fullName != null) updates['full_name'] = fullName;
    if (phone != null) updates['phone'] = phone;
    if (avatarUrl != null) updates['avatar_url'] = avatarUrl;
    
    await _client.from('profiles').upsert(updates);
  }
}
