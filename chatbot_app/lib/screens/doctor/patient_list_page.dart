import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../services/database_service.dart';

class PatientListPage extends StatefulWidget {
  const PatientListPage({super.key});

  @override
  State<PatientListPage> createState() => _PatientListPageState();
}

class _PatientListPageState extends State<PatientListPage> {
  static const _primaryGradientStart = Color(0xFF6C63FF);
  static const _textPrimary = Color(0xFFFFFFFF);
  static const _textSecondary = Color(0xFFB0B0D0);
  static const _cardBg = Color(0xFF1A1A3E);
  static const _accentColor = Color(0xFF00D9A6);

  List<Map<String, dynamic>> _patients = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchPatients();
  }

  Future<void> _fetchPatients() async {
    final uid = DatabaseService().currentUserId;
    if (uid != null) {
      final patients = await DatabaseService().getPatientsForDoctor(uid);
      debugPrint('FETCHED PATIENTS: $patients'); // Debug Log
      if (mounted) {
        setState(() {
          _patients = patients;
          _isLoading = false;
        });
      }
    } else {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F0F23),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text(
          'My Patients',
          style: GoogleFonts.outfit(
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: _textPrimary,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.search_rounded, color: _textSecondary),
            onPressed: () {},
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: _primaryGradientStart))
          : _patients.isEmpty
              ? _buildEmptyState()
              : ListView.builder(
                  padding: const EdgeInsets.all(20),
                  itemCount: _patients.length,
                  itemBuilder: (context, index) {
                    final patient = _patients[index];
                    return _buildPatientCard(patient);
                  },
                ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // TODO: Implement add patient flow
        },
        backgroundColor: _primaryGradientStart,
        child: const Icon(Icons.person_add_rounded, color: Colors.white),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
            Icon(Icons.people_outline_rounded, size: 60, color: _textSecondary.withOpacity(0.5)),
            const SizedBox(height: 16),
            Text(
              'No patients assigned yet',
              style: GoogleFonts.inter(color: _textSecondary),
            ),
        ],
      ),
    );
  }

  Widget _buildPatientCard(Map<String, dynamic> data) {
    // Robust parsing for profiles (handle Map or List)
    var profileData = data['profiles'];
    if (profileData is List) {
      profileData = profileData.isNotEmpty ? profileData.first : {};
    }
    final profile = (profileData as Map<String, dynamic>?) ?? {};

    // Extract medical data
    var medicalData = profile['patient_medical_data']; // Nested in profile
    // Fallback: check if it's at root level if query changed
    if (medicalData == null) {
       medicalData = data['patient_medical_data'];
    }

    if (medicalData is List) {
      medicalData = medicalData.isNotEmpty ? medicalData.first : {};
    }
    final medical = (medicalData as Map<String, dynamic>?) ?? {};
    
    final name = profile['full_name'] ?? 'Unknown Patient';
    final age = 'N/A'; // Age usually calculated from DOB in profile
    final gender = 'Unknown'; // Gender usually in profile
    final condition = medical['condition'] ?? 'Checkup';
    final status = medical['status'] ?? 'Stable';
    final lastVisit = medical['last_visit'] != null 
        ? DateTime.parse(medical['last_visit']).toString().split(' ')[0] 
        : 'New';

    Color statusColor;
    switch (status.toString().toLowerCase()) {
      case 'critical':
        statusColor = const Color(0xFFFF6B6B);
        break;
      case 'improving':
        statusColor = _accentColor;
        break;
      default:
        statusColor = const Color(0xFF3F8CFF);
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 28,
            backgroundColor: _primaryGradientStart.withOpacity(0.2),
            child: Text(
              name.isNotEmpty ? name[0] : '?',
              style: GoogleFonts.outfit(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: _primaryGradientStart,
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: GoogleFonts.outfit(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: _textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '$condition',
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    color: _textSecondary,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(Icons.history_rounded, size: 14, color: _textSecondary.withOpacity(0.7)),
                    const SizedBox(width: 4),
                    Text(
                      'Last visit: $lastVisit',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: _textSecondary.withOpacity(0.7),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Column(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: statusColor.withOpacity(0.2)),
                ),
                child: Text(
                  status,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: statusColor,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Icon(Icons.chevron_right_rounded, color: _textSecondary),
            ],
          ),
        ],
      ),
    );
  }
}
