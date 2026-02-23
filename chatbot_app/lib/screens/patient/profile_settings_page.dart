import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../services/auth_service.dart';
// Removed ai_service import as the tab is removed
import '../login_page.dart';
import 'past_history_page.dart';

import 'package:shared_preferences/shared_preferences.dart';

class ProfileSettingsPage extends StatefulWidget {
  const ProfileSettingsPage({super.key});

  @override
  State<ProfileSettingsPage> createState() => _ProfileSettingsPageState();
}

class _ProfileSettingsPageState extends State<ProfileSettingsPage> {
  bool _notificationsEnabled = true;
  bool _biometricEnabled = false;
  bool _darkModeEnabled = true;
  bool _dataShareEnabled = false;

  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _dobController = TextEditingController();
  final TextEditingController _bloodTypeController = TextEditingController();
  final TextEditingController _emergencyContactController = TextEditingController();
  bool _isSaving = false;

  static const _primaryGradientStart = Color(0xFF6C63FF);
  static const _primaryGradientEnd = Color(0xFF3F8CFF);
  static const _accentColor = Color(0xFF00D9A6);
  static const _darkBg = Color(0xFF0F0F23);
  static const _cardBg = Color(0xFF1A1A3E);
  static const _surfaceBg = Color(0xFF252550);
  static const _textPrimary = Color(0xFFFFFFFF);
  static const _textSecondary = Color(0xFFB0B0D0);

  @override
  void initState() {
    super.initState();
    _loadProfileData();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _notificationsEnabled = prefs.getBool('notifications_enabled') ?? true;
      _biometricEnabled = prefs.getBool('biometric_enabled') ?? false;
      _darkModeEnabled = prefs.getBool('dark_mode_enabled') ?? true;
      _dataShareEnabled = prefs.getBool('data_share_enabled') ?? false;
    });
  }

  Future<void> _saveSetting(String key, bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(key, value);
  }

  void _loadProfileData() {
    final user = AuthService.currentUser;
    if (user != null) {
      final metadata = user.userMetadata ?? {};
      _phoneController.text = metadata['phone'] ?? '';
      _dobController.text = metadata['dob'] ?? '';
      _bloodTypeController.text = metadata['blood_type'] ?? '';
      _emergencyContactController.text = metadata['emergency_contact'] ?? '';
    }
  }

  Future<void> _saveProfile() async {
    setState(() => _isSaving = true);
    try {
      await AuthService.updateProfile(
        phone: _phoneController.text,
        dob: _dobController.text,
        bloodType: _bloodTypeController.text,
        emergencyContact: _emergencyContactController.text,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile updated successfully!')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error updating profile: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  void _showChangePasswordDialog() {
    final passwordController = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: _cardBg,
        title: Text('Change Password', style: GoogleFonts.outfit(color: _textPrimary)),
        content: TextField(
          controller: passwordController,
          obscureText: true,
          style: GoogleFonts.inter(color: _textPrimary),
          decoration: InputDecoration(
            hintText: 'New Password',
            hintStyle: GoogleFonts.inter(color: _textSecondary),
            enabledBorder: const UnderlineInputBorder(borderSide: BorderSide(color: _textSecondary)),
            focusedBorder: const UnderlineInputBorder(borderSide: BorderSide(color: _accentColor)),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancel', style: GoogleFonts.inter(color: _textSecondary)),
          ),
          TextButton(
            onPressed: () async {
              if (passwordController.text.isNotEmpty) {
                Navigator.pop(context);
                try {
                  await AuthService.changePassword(passwordController.text);
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Password updated successfully!')),
                    );
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Error: $e')),
                    );
                  }
                }
              }
            },
            child: Text('Update', style: GoogleFonts.inter(color: _accentColor, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _showInfoSheet(String title, String content) {
    showModalBottomSheet(
      context: context,
      backgroundColor: _darkBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Container(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(title, style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _textPrimary)),
            const SizedBox(height: 16),
            Text(content, style: GoogleFonts.inter(fontSize: 14, color: _textSecondary, height: 1.5)),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _primaryGradientStart,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: Text('Close', style: GoogleFonts.inter(color: Colors.white)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _dobController.dispose();
    _bloodTypeController.dispose();
    _emergencyContactController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final userName = AuthService.currentUserName ?? 'Patient';
    final userEmail = AuthService.currentUser?.email ?? '';

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Profile Card
          _buildProfileCard(userName, userEmail),
          const SizedBox(height: 28),

          // Personal Information Section
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Personal Information',
                style: GoogleFonts.outfit(
                  fontSize: 20,
                  fontWeight: FontWeight.w600,
                  color: _textPrimary,
                ),
              ),
              if (_isSaving)
                const SizedBox(
                  width: 20, 
                  height: 20, 
                  child: CircularProgressIndicator(strokeWidth: 2, color: _accentColor)
                )
              else
                IconButton(
                  onPressed: _saveProfile,
                  icon: const Icon(Icons.save_rounded, color: _accentColor),
                  tooltip: 'Save Changes',
                ),
            ],
          ),
          const SizedBox(height: 16),
          _buildInfoRow('Full Name', userName, Icons.person_rounded), // Read-only
          const SizedBox(height: 12),
          _buildInfoRow('Email', userEmail, Icons.email_rounded), // Read-only
          const SizedBox(height: 12),
          
          // Editable Fields
          _buildEditableField('Phone', _phoneController, Icons.phone_rounded, keyboardType: TextInputType.phone),
          const SizedBox(height: 12),
          _buildEditableField('Date of Birth', _dobController, Icons.cake_rounded),
          const SizedBox(height: 12),
          _buildEditableField('Blood Type', _bloodTypeController, Icons.bloodtype_rounded),
          const SizedBox(height: 12),
          _buildEditableField('Emergency Contact', _emergencyContactController, Icons.emergency_rounded, keyboardType: TextInputType.phone),
          
          const SizedBox(height: 28),

          // Quick Access
          Text(
            'Quick Access',
            style: GoogleFonts.outfit(
              fontSize: 20,
              fontWeight: FontWeight.w600,
              color: _textPrimary,
            ),
          ),
          const SizedBox(height: 16),
          _buildActionItem(
            title: 'Medical History',
            subtitle: 'View past visits, conditions, and medications',
            icon: Icons.history_rounded,
            color: _primaryGradientStart,
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => Scaffold(
                    backgroundColor: _darkBg,
                    appBar: AppBar(
                      backgroundColor: _darkBg,
                      elevation: 0,
                      title: Text(
                        'Medical History',
                        style: GoogleFonts.outfit(
                          fontWeight: FontWeight.w600,
                          color: _textPrimary,
                        ),
                      ),
                      iconTheme: const IconThemeData(color: _textPrimary),
                    ),
                    body: const PastHistoryPage(),
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 28),

          // Settings
          Text(
            'Settings',
            style: GoogleFonts.outfit(
              fontSize: 20,
              fontWeight: FontWeight.w600,
              color: _textPrimary,
            ),
          ),
          const SizedBox(height: 16),
          _buildToggleSetting(
            title: 'Push Notifications',
            subtitle: 'Receive appointment reminders and updates',
            icon: Icons.notifications_rounded,
            color: const Color(0xFFFF9F43),
            value: _notificationsEnabled,
            onChanged: (val) {
              setState(() => _notificationsEnabled = val);
              _saveSetting('notifications_enabled', val);
            },
          ),
          const SizedBox(height: 12),
          _buildToggleSetting(
            title: 'Biometric Login',
            subtitle: 'Use fingerprint or face ID to sign in',
            icon: Icons.fingerprint_rounded,
            color: _primaryGradientStart,
            value: _biometricEnabled,
            onChanged: (val) {
              setState(() => _biometricEnabled = val);
              _saveSetting('biometric_enabled', val);
            },
          ),
          const SizedBox(height: 12),
          _buildToggleSetting(
            title: 'Dark Mode',
            subtitle: 'Enable dark theme for the app',
            icon: Icons.dark_mode_rounded,
            color: _primaryGradientEnd,
            value: _darkModeEnabled,
            onChanged: (val) {
              setState(() => _darkModeEnabled = val);
              _saveSetting('dark_mode_enabled', val);
            },
          ),
          const SizedBox(height: 12),
          _buildToggleSetting(
            title: 'Share Health Data',
            subtitle: 'Allow doctors to access your health metrics',
            icon: Icons.share_rounded,
            color: _accentColor,
            value: _dataShareEnabled,
            onChanged: (val) {
              setState(() => _dataShareEnabled = val);
              _saveSetting('data_share_enabled', val);
            },
          ),
          const SizedBox(height: 28),

          // Account
          Text(
            'Account',
            style: GoogleFonts.outfit(
              fontSize: 20,
              fontWeight: FontWeight.w600,
              color: _textPrimary,
            ),
          ),
          const SizedBox(height: 16),
          _buildSimpleAction(
            title: 'Change Password',
            icon: Icons.lock_rounded,
            color: _primaryGradientStart,
            onTap: _showChangePasswordDialog,
          ),
          const SizedBox(height: 12),
          _buildSimpleAction(
            title: 'Privacy Policy',
            icon: Icons.privacy_tip_rounded,
            color: _primaryGradientEnd,
            onTap: () => _showInfoSheet('Privacy Policy', 'Your privacy is important to us. This policy outlines how we collect, use, and protect your personal health information... (Demo Content)'),
          ),
          const SizedBox(height: 12),
          _buildSimpleAction(
            title: 'Terms of Service',
            icon: Icons.description_rounded,
            color: const Color(0xFFFF9F43),
            onTap: () => _showInfoSheet('Terms of Service', 'By using Zenova, you agree to our terms of service. You must be at least 18 years old to use this platform... (Demo Content)'),
          ),
          const SizedBox(height: 12),
          _buildSimpleAction(
            title: 'Help & Support',
            icon: Icons.help_rounded,
            color: _accentColor,
            onTap: () => _showInfoSheet('Help & Support', 'Need help? Contact our support team at support@zenova.com or call +1-800-ZENOVA-HELP.'),
          ),
          const SizedBox(height: 24),

          // Security Note
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: _accentColor.withAlpha(10),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: _accentColor.withAlpha(25)),
            ),
            child: Row(
              children: [
                Icon(Icons.verified_user_rounded,
                    color: _accentColor, size: 22),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'AES-256 Encrypted',
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: _accentColor,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        'All medical data is encrypted and stored securely. AI powered by Groq with open-source Llama models.',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: _textSecondary,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Logout Button
          GestureDetector(
            onTap: () async {
              await AuthService.signOut();
              if (context.mounted) {
                Navigator.pushAndRemoveUntil(
                  context,
                  MaterialPageRoute(builder: (_) => const LoginPage()),
                  (route) => false,
                );
              }
            },
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 16),
              decoration: BoxDecoration(
                color: Colors.redAccent.withAlpha(15),
                borderRadius: BorderRadius.circular(16),
                border:
                    Border.all(color: Colors.redAccent.withAlpha(40)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.logout_rounded,
                      color: Colors.redAccent, size: 20),
                  const SizedBox(width: 10),
                  Text(
                    'Sign Out',
                    style: GoogleFonts.inter(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Colors.redAccent,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),

          Center(
            child: Text(
              'Zenova v1.0.0 • AI-Powered Healthcare Platform',
              style: GoogleFonts.inter(
                fontSize: 12,
                color: _textSecondary.withAlpha(100),
              ),
            ),
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _buildProfileCard(String name, String email) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            _primaryGradientStart.withAlpha(60),
            _primaryGradientEnd.withAlpha(40),
          ],
        ),
        border: Border.all(color: _primaryGradientStart.withAlpha(50)),
      ),
      child: Row(
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [_primaryGradientStart, _primaryGradientEnd],
              ),
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: _primaryGradientStart.withAlpha(60),
                  blurRadius: 15,
                  offset: const Offset(0, 5),
                ),
              ],
            ),
            child: Center(
              child: Text(
                name.isNotEmpty ? name[0].toUpperCase() : 'P',
                style: GoogleFonts.outfit(
                  fontSize: 30,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
          ),
          const SizedBox(width: 18),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: GoogleFonts.outfit(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: _textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  email,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    color: _textSecondary,
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                    color: _accentColor.withAlpha(20),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '● Active Member',
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: _accentColor,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEditableField(String label, TextEditingController controller, IconData icon, {TextInputType? keyboardType}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: _cardBg.withAlpha(200),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _primaryGradientStart.withAlpha(15)),
      ),
      child: Row(
        children: [
          Icon(icon, color: _textSecondary, size: 20),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: GoogleFonts.inter(
                      fontSize: 12, color: _textSecondary),
                ),
                TextField(
                  controller: controller,
                  decoration: const InputDecoration(
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.symmetric(vertical: 4),
                  ),
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: _textPrimary,
                  ),
                  keyboardType: keyboardType,
                ),
              ],
            ),
          ),
          Icon(Icons.edit_rounded, size: 16, color: _textSecondary.withAlpha(100)),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _cardBg.withAlpha(200),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _primaryGradientStart.withAlpha(15)),
      ),
      child: Row(
        children: [
          Icon(icon, color: _textSecondary, size: 20),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: GoogleFonts.inter(
                      fontSize: 12, color: _textSecondary),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: _textPrimary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildToggleSetting({
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _cardBg.withAlpha(200),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withAlpha(20)),
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: color.withAlpha(20),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: _textPrimary,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: _textSecondary,
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeColor: _accentColor,
            activeTrackColor: _accentColor.withAlpha(80),
            inactiveThumbColor: _textSecondary,
            inactiveTrackColor: _surfaceBg,
          ),
        ],
      ),
    );
  }

  Widget _buildActionItem({
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: _cardBg.withAlpha(200),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withAlpha(25)),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: color.withAlpha(25),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: color, size: 24),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.inter(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: _textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      color: _textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded,
                color: _textSecondary.withAlpha(100), size: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildSimpleAction({
    required String title,
    required IconData icon,
    required Color color,
    VoidCallback? onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: _cardBg.withAlpha(200),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withAlpha(20)),
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: color.withAlpha(20),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                title,
                style: GoogleFonts.inter(
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                  color: _textPrimary,
                ),
              ),
            ),
            Icon(Icons.chevron_right_rounded,
                color: _textSecondary.withAlpha(100), size: 22),
          ],
        ),
      ),
    );
  }
}
