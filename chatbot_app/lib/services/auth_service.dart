import 'package:supabase_flutter/supabase_flutter.dart';

class AuthService {
  static final SupabaseClient _supabase = Supabase.instance.client;

  /// Sign up a new user with email, password, and role
  static Future<AuthResponse> signUp({
    required String email,
    required String password,
    required String role,
    required String fullName,
  }) async {
    final response = await _supabase.auth.signUp(
      email: email,
      password: password,
      data: {
        'role': role,
        'full_name': fullName,
      },
    );
    return response;
  }

  static Future<AuthResponse> signIn({
    required String email,
    required String password,
  }) async {
    final response = await _supabase.auth.signInWithPassword(
      email: email,
      password: password,
    );
    return response;
  }

  static Future<void> signOut() async {
    await _supabase.auth.signOut();
  }

  static User? get currentUser => _supabase.auth.currentUser;


  static String? get currentUserRole {
    final user = currentUser;
    if (user == null) return null;
    return user.userMetadata?['role'] as String?;
  }

  /// Get the full name of the current user from metadata
  static String? get currentUserName {
    final user = currentUser;
    if (user == null) return null;
    return user.userMetadata?['full_name'] as String?;
  }

  /// Check if a user is currently signed in
  static bool get isSignedIn => currentUser != null;

  /// Update user profile metadata
  static Future<void> updateProfile({
    String? phone,
    String? dob,
    String? bloodType,
    String? emergencyContact,
  }) async {
    final updates = <String, dynamic>{};
    if (phone != null) updates['phone'] = phone;
    if (dob != null) updates['dob'] = dob;
    if (bloodType != null) updates['blood_type'] = bloodType;
    if (emergencyContact != null) updates['emergency_contact'] = emergencyContact;

    if (updates.isNotEmpty) {
      await _supabase.auth.updateUser(
        UserAttributes(data: updates),
      );
    }
  }

  /// Change user password
  static Future<void> changePassword(String newPassword) async {
    await _supabase.auth.updateUser(
      UserAttributes(password: newPassword),
    );
  }

  /// Listen to auth state changes
  static Stream<AuthState> get authStateChanges =>
      _supabase.auth.onAuthStateChange;
}
