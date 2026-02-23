
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../services/database_service.dart';

class MyDoctorCard extends StatefulWidget {
  const MyDoctorCard({super.key});

  @override
  State<MyDoctorCard> createState() => _MyDoctorCardState();
}

class _MyDoctorCardState extends State<MyDoctorCard> {
  Map<String, dynamic>? _doctor;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchDoctor();
  }

  Future<void> _fetchDoctor() async {
    final uid = DatabaseService().currentUserId;
    if (uid != null) {
      final doc = await DatabaseService().getAssignedDoctor(uid);
      if (mounted) {
        setState(() {
          _doctor = doc;
          _isLoading = false;
        });
      }
    } else {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const SizedBox.shrink();
    if (_doctor == null) return const SizedBox.shrink(); // Hide if no doctor assigned

    final name = _doctor!['full_name'] ?? 'Doctor';
    final email = _doctor!['email'] ?? '';

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF6C63FF), Color(0xFF3F8CFF)],
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF6C63FF).withOpacity(0.3),
            blurRadius: 15,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.2),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.medical_services_rounded, color: Colors.white, size: 30),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Your Primary Care',
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: Colors.white.withOpacity(0.8),
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Dr. $name',
                  style: GoogleFonts.outfit(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
                if (email.isNotEmpty)
                  Text(
                    email,
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      color: Colors.white.withOpacity(0.7),
                    ),
                  ),
              ],
            ),
          ),
          IconButton(
            onPressed: () {
                // TODO: Navigate to doctor details or chat
            },
            icon: const Icon(Icons.chat_bubble_outline_rounded, color: Colors.white),
          ),
        ],
      ),
    );
  }
}
