import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/auth_service.dart';
import 'login_page.dart';
import 'patient/report_analysis_page.dart';
import 'patient/ai_chat_page.dart';
import 'patient/profile_settings_page.dart';
import 'patient/my_doctor_card.dart';

class PatientProfilePage extends StatefulWidget {
  const PatientProfilePage({super.key});

  @override
  State<PatientProfilePage> createState() => _PatientProfilePageState();
}

class _PatientProfilePageState extends State<PatientProfilePage>
    with SingleTickerProviderStateMixin {
  int _currentIndex = 0;
  late final AnimationController _animController;
  late Animation<double> _fadeAnimation;

  static const _primaryGradientStart = Color(0xFF6C63FF);
  static const _primaryGradientEnd = Color(0xFF3F8CFF);
  static const _accentColor = Color(0xFF00D9A6);
  static const _darkBg = Color(0xFF0F0F23);
  static const _surfaceBg = Color(0xFF252550);
  static const _cardBg = Color(0xFF1A1A3E);
  static const _textPrimary = Color(0xFFFFFFFF);
  static const _textSecondary = Color(0xFFB0B0D0);

  final List<String> _tabTitles = [
    'Report Analysis',
    'AI Health Chat',
    'Profile & Settings',
  ];

  final List<Widget> _pages = const [
    ReportAnalysisPage(),
    AiChatPage(),
    ProfileSettingsPage(),
  ];

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 250),
    );
    _fadeAnimation = CurvedAnimation(
      parent: _animController,
      curve: Curves.easeInOut,
    );
    _animController.forward();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  void _onTabChanged(int index) {
    if (index == _currentIndex) return;
    _animController.reverse().then((_) {
      setState(() => _currentIndex = index);
      _animController.forward();
    });
  }

  @override
  Widget build(BuildContext context) {
    final userName = AuthService.currentUserName ?? 'Patient';
    final userEmail = AuthService.currentUser?.email ?? '';

    return Scaffold(
      backgroundColor: _darkBg,
      body: Stack(
        children: [
          // Background orbs
          Positioned(
            top: -70,
            right: -50,
            child: Container(
              width: 220,
              height: 220,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    _accentColor.withAlpha(50),
                    _accentColor.withAlpha(0),
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            bottom: -60,
            left: -40,
            child: Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    _primaryGradientEnd.withAlpha(45),
                    _primaryGradientEnd.withAlpha(0),
                  ],
                ),
              ),
            ),
          ),
          SafeArea(
            child: Column(
              children: [
                // ── Compact Patient Header ──
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                  child: Row(
                    children: [
                      // Avatar
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [
                              _primaryGradientStart,
                              _primaryGradientEnd,
                            ],
                          ),
                          borderRadius: BorderRadius.circular(14),
                          boxShadow: [
                            BoxShadow(
                              color: _primaryGradientStart.withAlpha(50),
                              blurRadius: 10,
                              offset: const Offset(0, 3),
                            ),
                          ],
                        ),
                        child: Center(
                          child: Text(
                            userName.isNotEmpty
                                ? userName[0].toUpperCase()
                                : 'P',
                            style: GoogleFonts.outfit(
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      // Name + Section
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              userName,
                              style: GoogleFonts.outfit(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                color: _textPrimary,
                              ),
                            ),
                            Row(
                              children: [
                                Container(
                                  width: 4,
                                  height: 4,
                                  decoration: BoxDecoration(
                                    color: _accentColor,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Flexible(
                                  child: Text(
                                    _tabTitles[_currentIndex],
                                    overflow: TextOverflow.ellipsis,
                                    style: GoogleFonts.inter(
                                      fontSize: 13,
                                      color: _textSecondary,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      // Actions
                      _buildIconButton(Icons.notifications_none_rounded),
                      const SizedBox(width: 8),
                      _buildLogoutButton(context),
                    ],
                  ),
                ),
                const SizedBox(height: 10),

                // Assigned Doctor Card
                const MyDoctorCard(),

                // Divider
                Container(
                  height: 1,
                  margin: const EdgeInsets.symmetric(horizontal: 20),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        _primaryGradientStart.withAlpha(0),
                        _primaryGradientStart.withAlpha(35),
                        _primaryGradientEnd.withAlpha(35),
                        _primaryGradientEnd.withAlpha(0),
                      ],
                    ),
                  ),
                ),

                // ── Tab Content ──
                Expanded(
                  child: FadeTransition(
                    opacity: _fadeAnimation,
                    child: IndexedStack(
                      index: _currentIndex,
                      children: _pages,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),

      // ── Bottom Navigation Bar ──
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: _cardBg,
          border: Border(
            top: BorderSide(color: _primaryGradientStart.withAlpha(20)),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withAlpha(80),
              blurRadius: 20,
              offset: const Offset(0, -5),
            ),
          ],
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildNavItem(
                  index: 0,
                  icon: Icons.analytics_rounded,
                  label: 'Reports',
                ),
                _buildNavItem(
                  index: 1,
                  icon: Icons.auto_awesome_rounded,
                  label: 'AI Chat',
                ),
                _buildNavItem(
                  index: 2,
                  icon: Icons.person_rounded,
                  label: 'Profile',
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ── Helper Widgets ──

  Widget _buildNavItem({
    required int index,
    required IconData icon,
    required String label,
  }) {
    final isSelected = _currentIndex == index;
    final color =
        isSelected ? _accentColor : _textSecondary.withAlpha(100);

    return GestureDetector(
      onTap: () => _onTabChanged(index),
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeInOut,
        padding: EdgeInsets.symmetric(
          horizontal: isSelected ? 14 : 10,
          vertical: 8,
        ),
        decoration: BoxDecoration(
          color: isSelected
              ? _accentColor.withAlpha(15)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 3),
            Text(
              label,
              style: GoogleFonts.inter(
                fontSize: 10,
                fontWeight:
                    isSelected ? FontWeight.w600 : FontWeight.w400,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildIconButton(IconData icon) {
    return Container(
      width: 38,
      height: 38,
      decoration: BoxDecoration(
        color: _surfaceBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _textSecondary.withAlpha(15)),
      ),
      child: Icon(icon, color: _textSecondary, size: 18),
    );
  }

  Widget _buildLogoutButton(BuildContext context) {
    return GestureDetector(
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
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: _surfaceBg,
          borderRadius: BorderRadius.circular(12),
          border:
              Border.all(color: Colors.redAccent.withAlpha(35)),
        ),
        child: const Icon(Icons.logout_rounded,
            color: Colors.redAccent, size: 16),
      ),
    );
  }
}
