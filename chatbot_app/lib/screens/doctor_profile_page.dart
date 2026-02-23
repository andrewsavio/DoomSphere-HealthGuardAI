import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/auth_service.dart';
import 'login_page.dart';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/auth_service.dart';
import 'login_page.dart';
import 'doctor/patient_list_page.dart';
import 'doctor/doctor_report_page.dart';
import 'doctor/doctor_assistant_chat_page.dart';
import '../../services/database_service.dart';

class DoctorProfilePage extends StatefulWidget {
  const DoctorProfilePage({super.key});

  @override
  State<DoctorProfilePage> createState() => _DoctorProfilePageState();
}

class _DoctorProfilePageState extends State<DoctorProfilePage> {
  int _selectedIndex = 0;

  static const _primaryGradientStart = Color(0xFF6C63FF);
  static const _primaryGradientEnd = Color(0xFF3F8CFF);
  static const _accentColor = Color(0xFF00D9A6);
  static const _darkBg = Color(0xFF0F0F23);
  static const _cardBg = Color(0xFF1A1A3E);
  static const _surfaceBg = Color(0xFF252550);
  static const _textPrimary = Color(0xFFFFFFFF);
  static const _textSecondary = Color(0xFFB0B0D0);

  List<Widget> _buildPages() {
    return [
      DoctorDashboardView(onTabChange: _onItemTapped),
      const PatientListPage(),
      const DoctorReportPage(),
      const DoctorAssistantChatPage(),
    ];
  }

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _darkBg,
      body: IndexedStack(
        index: _selectedIndex,
        children: _buildPages(),
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: _surfaceBg,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.2),
              blurRadius: 10,
              offset: const Offset(0, -5),
            ),
          ],
        ),
        child: BottomNavigationBar(
          currentIndex: _selectedIndex,
          onTap: _onItemTapped,
          backgroundColor: Colors.transparent,
          elevation: 0,
          type: BottomNavigationBarType.fixed,
          selectedItemColor: _accentColor,
          unselectedItemColor: _textSecondary,
          selectedLabelStyle: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 12),
          unselectedLabelStyle: GoogleFonts.inter(fontWeight: FontWeight.w400, fontSize: 11),
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.dashboard_rounded),
              label: 'Dashboard',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.people_alt_rounded),
              label: 'Patients',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.analytics_rounded),
              label: 'Reports',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.support_agent_rounded),
              label: 'Assistant',
            ),
          ],
        ),
      ),
    );
  }
}

class DoctorDashboardView extends StatefulWidget {
  final Function(int)? onTabChange;
  const DoctorDashboardView({super.key, this.onTabChange});

  @override
  State<DoctorDashboardView> createState() => _DoctorDashboardViewState();
}

class _DoctorDashboardViewState extends State<DoctorDashboardView> {
  static const _primaryGradientStart = Color(0xFF6C63FF);
  static const _primaryGradientEnd = Color(0xFF3F8CFF);
  static const _accentColor = Color(0xFF00D9A6);
  static const _cardBg = Color(0xFF1A1A3E);
  static const _surfaceBg = Color(0xFF252550);
  static const _darkBg = Color(0xFF0F0F23);
  static const _textPrimary = Color(0xFFFFFFFF);
  static const _textSecondary = Color(0xFFB0B0D0);

  Map<String, dynamic> _stats = {
    'patients_count': 0,
    'appointments_count': 0,
    'rating': 5.0,
  };
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchStats();
  }

  Future<void> _fetchStats() async {
    final uid = DatabaseService().currentUserId;
    if (uid != null) {
      final stats = await DatabaseService().getDoctorStats(uid);
      if (mounted) {
        setState(() {
          _stats = stats;
          _isLoading = false;
        });
      }
    } else {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final userName = AuthService.currentUserName ?? 'Doctor';
    final userEmail = AuthService.currentUser?.email ?? '';

    return Stack(
      children: [
        // Background orbs
        Positioned(
          top: -60,
          left: -40,
          child: Container(
            width: 200,
            height: 200,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [
                  _primaryGradientStart.withAlpha(50),
                  _primaryGradientStart.withAlpha(0),
                ],
              ),
            ),
          ),
        ),
        Positioned(
          bottom: -80,
          right: -50,
          child: Container(
            width: 250,
            height: 250,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [
                  _accentColor.withAlpha(40),
                  _accentColor.withAlpha(0),
                ],
              ),
            ),
          ),
        ),
        SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top Bar
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Doctor Dashboard',
                      style: GoogleFonts.outfit(
                        fontSize: 24,
                        fontWeight: FontWeight.w700,
                        color: _textPrimary,
                      ),
                    ),
                    _buildLogoutButton(context),
                  ],
                ),
                const SizedBox(height: 32),

                // Profile Card
                _buildProfileCard(userName, userEmail),
                const SizedBox(height: 24),

                // Stats Row
                Row(
                  children: [
                    Expanded(child: _buildStatCard('Patients', '${_stats['patients_count']}', Icons.people_rounded)),
                    const SizedBox(width: 14),
                    Expanded(child: _buildStatCard('Appointments', '${_stats['appointments_count']}', Icons.calendar_today_rounded)),
                    const SizedBox(width: 14),
                    Expanded(child: _buildStatCard('Rating', '${_stats['rating']}', Icons.star_rounded)),
                  ],
                ),
                const SizedBox(height: 24),

                // Quick Actions
                Text(
                  'Quick Actions',
                  style: GoogleFonts.outfit(
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                    color: _textPrimary,
                  ),
                ),
                const SizedBox(height: 16),
                _buildActionTile(
                  icon: Icons.video_call_rounded,
                  title: 'Start Consultation',
                  subtitle: 'Begin a video call with a patient',
                  color: _primaryGradientStart,
                  onTap: _handleStartConsultation,
                ),
                const SizedBox(height: 12),
                _buildActionTile(
                  icon: Icons.note_add_rounded,
                  title: 'Write Prescription',
                  subtitle: 'Create a new prescription for a patient',
                  color: _accentColor,
                  onTap: _handleWritePrescription,
                ),
                const SizedBox(height: 12),
                _buildActionTile(
                  icon: Icons.schedule_rounded,
                  title: 'Manage Schedule',
                  subtitle: 'View and update your availability',
                  color: _primaryGradientEnd,
                  onTap: _handleManageSchedule,
                ),
                const SizedBox(height: 12),
                _buildActionTile(
                  icon: Icons.analytics_rounded,
                  title: 'View Reports',
                  subtitle: 'Access patient reports and analytics',
                  color: const Color(0xFFFF6B6B),
                  onTap: _handleViewReports,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  void _handleStartConsultation() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: _cardBg,
        title: Text('Start Consultation', style: GoogleFonts.outfit(color: _textPrimary)),
        content: Text('Connecting to secure video channel...', style: GoogleFonts.inter(color: _textSecondary)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel', style: GoogleFonts.inter(color: Colors.redAccent)),
          ),
        ],
      ),
    );
     // Simulate connection
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted && Navigator.canPop(context)) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Patient is offline. Scheduled for later.')),
        );
      }
    });
  }

  void _handleWritePrescription() {
      showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: _darkBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
          left: 20, right: 20, top: 20
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Write Prescription', style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _textPrimary)),
            const SizedBox(height: 16),
            TextField(
              decoration: InputDecoration(
                hintText: 'Patient Name',
                hintStyle: GoogleFonts.inter(color: _textSecondary),
                filled: true,
                fillColor: _cardBg,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              ),
              style: GoogleFonts.inter(color: _textPrimary),
            ),
             const SizedBox(height: 12),
            TextField(
              maxLines: 4,
              decoration: InputDecoration(
                hintText: 'Medication & Dosage...',
                hintStyle: GoogleFonts.inter(color: _textSecondary),
                filled: true,
                fillColor: _cardBg,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              ),
              style: GoogleFonts.inter(color: _textPrimary),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Prescription sent successfully')));
                },
                style: ElevatedButton.styleFrom(backgroundColor: _accentColor),
                child: const Text('Send Prescription'),
              ),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  void _handleManageSchedule() {
     showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 30)),
      builder: (context, child) {
        return Theme(
          data: ThemeData.dark().copyWith(
            colorScheme: const ColorScheme.dark(
              primary: _primaryGradientStart,
              onPrimary: Colors.white,
              surface: _cardBg,
              onSurface: _textPrimary,
            ),
          ),
          child: child!,
        );
      },
    ).then((date) {
      if (date != null) {
         ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Availability updated for ${date.toString().split(' ')[0]}')),
        );
      }
    });
  }

  void _handleViewReports() {
    widget.onTabChange?.call(2); // Index 2 is DoctorReportPage
  }

  Widget _buildLogoutButton(BuildContext context) {
    return GestureDetector(
      onTap: () async {
        await AuthService.signOut();
        if (context.mounted) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (_) => const LoginPage()),
          );
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: _surfaceBg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.redAccent.withAlpha(60)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.logout_rounded, color: Colors.redAccent, size: 18),
            const SizedBox(width: 6),
            Text(
              'Logout',
              style: GoogleFonts.inter(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: Colors.redAccent,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileCard(String name, String email) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_primaryGradientStart, _primaryGradientEnd],
        ),
        boxShadow: [
          BoxShadow(
            color: _primaryGradientStart.withAlpha(80),
            blurRadius: 30,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 70,
            height: 70,
            decoration: BoxDecoration(
              color: Colors.white.withAlpha(50),
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Icon(
              Icons.medical_services_rounded,
              color: Colors.white,
              size: 36,
            ),
          ),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Dr. $name',
                  style: GoogleFonts.outfit(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  email,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    color: Colors.white.withAlpha(180),
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white.withAlpha(40),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '● Online',
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

  Widget _buildStatCard(String label, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: _cardBg.withAlpha(200),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _primaryGradientStart.withAlpha(30)),
      ),
      child: Column(
        children: [
          Icon(icon, color: _accentColor, size: 26),
          const SizedBox(height: 10),
          Text(
            value,
            style: GoogleFonts.outfit(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: _textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 12,
              color: _textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    VoidCallback? onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: _cardBg.withAlpha(200),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withAlpha(30)),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: color.withAlpha(30),
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
            Icon(Icons.chevron_right_rounded, color: _textSecondary.withAlpha(100), size: 24),
          ],
        ),
      ),
    );
  }
}

