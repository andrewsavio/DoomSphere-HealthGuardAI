import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../services/medical_data_service.dart';

class PastHistoryPage extends StatefulWidget {
  const PastHistoryPage({super.key});

  @override
  State<PastHistoryPage> createState() => _PastHistoryPageState();
}

class _PastHistoryPageState extends State<PastHistoryPage> {
  static const _primaryGradientStart = Color(0xFF6C63FF);
  static const _primaryGradientEnd = Color(0xFF3F8CFF);
  static const _accentColor = Color(0xFF00D9A6);
  static const _cardBg = Color(0xFF1A1A3E);
  static const _textPrimary = Color(0xFFFFFFFF);
  static const _textSecondary = Color(0xFFB0B0D0);

  bool _isLoading = true;
  List<Map<String, dynamic>> _history = [];

  @override
  void initState() {
    super.initState();
    _fetchHistory();
  }

  Future<void> _fetchHistory() async {
    final data = await MedicalDataService.getHistory();
    setState(() {
      _history = data;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Timeline Stats
          Row(
            children: [
              Expanded(
                child: _buildHistoryStatCard(
                  label: 'Visits',
                  value: _history.length.toString(),
                  icon: Icons.local_hospital_rounded,
                  color: _primaryGradientStart,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildHistoryStatCard(
                  label: 'Prescriptions',
                  value: '23',
                  icon: Icons.medication_rounded,
                  color: _accentColor,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildHistoryStatCard(
                  label: 'Surgeries',
                  value: '2',
                  icon: Icons.healing_rounded,
                  color: const Color(0xFFFF6B6B),
                ),
              ),
            ],
          ),
          const SizedBox(height: 28),

          // Medical Conditions
          Text(
            'Medical Conditions',
            style: GoogleFonts.outfit(
              fontSize: 20,
              fontWeight: FontWeight.w600,
              color: _textPrimary,
            ),
          ),
          const SizedBox(height: 16),
          _buildConditionChip('Hypertension', _primaryGradientStart),
          const SizedBox(height: 8),
          _buildConditionChip('Type 2 Diabetes', const Color(0xFFFF9F43)),
          const SizedBox(height: 8),
          _buildConditionChip(
              'Seasonal Allergies', _accentColor),
          const SizedBox(height: 28),

          // Allergies
          Text(
            'Known Allergies',
            style: GoogleFonts.outfit(
              fontSize: 20,
              fontWeight: FontWeight.w600,
              color: _textPrimary,
            ),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _buildAllergyChip('Penicillin'),
              _buildAllergyChip('Shellfish'),
              _buildAllergyChip('Latex'),
              _buildAllergyChip('Pollen'),
            ],
          ),
          const SizedBox(height: 28),

          // Visit Timeline
          Text(
            'Visit History',
            style: GoogleFonts.outfit(
              fontSize: 20,
              fontWeight: FontWeight.w600,
              color: _textPrimary,
            ),
          ),
          const SizedBox(height: 16),

          if (_history.isEmpty)
             Text(
              'No history records found.',
              style: GoogleFonts.inter(color: _textSecondary),
             )
          else
            ..._history.asMap().entries.map((entry) {
              final index = entry.key;
              final item = entry.value;
              final date = item['date'] as DateTime;
              
              Color itemColor;
              switch ((item['status'] as String?)?.toLowerCase()) {
                case 'critical':
                  itemColor = const Color(0xFFFF6B6B);
                  break;
                case 'attention':
                  itemColor = const Color(0xFFFF9F43);
                  break;
                case 'normal':
                default: 
                  itemColor = index % 2 == 0 ? _accentColor : _primaryGradientStart;
              }

              IconData icon;
              if (item['type'] == 'report') icon = Icons.science_rounded;
              else if (item['type'] == 'visit') icon = Icons.medical_services_rounded;
              else icon = Icons.healing_rounded;

              return _buildTimelineItem(
                date: DateFormat('d MMM, yyyy').format(date),
                title: item['title'] ?? 'Unknown',
                doctor: item['doctor'] ?? 'N/A',
                description: item['summary'] ?? '',
                icon: icon,
                color: itemColor,
                isFirst: index == 0,
                isLast: index == _history.length - 1,
              );
            }),

          const SizedBox(height: 28),

          // Medications History
          Text(
            'Current Medications',
            style: GoogleFonts.outfit(
              fontSize: 20,
              fontWeight: FontWeight.w600,
              color: _textPrimary,
            ),
          ),
          const SizedBox(height: 16),
          _buildMedicationCard(
            name: 'Metformin 500mg',
            dosage: 'Twice daily with meals',
            since: 'Since Jan 2025',
            icon: Icons.medication_rounded,
            color: _accentColor,
          ),
          const SizedBox(height: 12),
          _buildMedicationCard(
            name: 'Lisinopril 10mg',
            dosage: 'Once daily in the morning',
            since: 'Since Mar 2024',
            icon: Icons.medication_liquid_rounded,
            color: _primaryGradientStart,
          ),
          const SizedBox(height: 12),
          _buildMedicationCard(
            name: 'Atorvastatin 20mg',
            dosage: 'Once daily at bedtime',
            since: 'Since Sep 2025',
            icon: Icons.medication_rounded,
            color: _primaryGradientEnd,
          ),
          const SizedBox(height: 12),
          _buildMedicationCard(
            name: 'Cetirizine 10mg',
            dosage: 'As needed for allergies',
            since: 'Since Jun 2023',
            icon: Icons.medication_liquid_rounded,
            color: const Color(0xFFFF9F43),
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _buildHistoryStatCard({
    required String label,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _cardBg.withAlpha(200),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withAlpha(40)),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(height: 10),
          Text(
            value,
            style: GoogleFonts.outfit(
              fontSize: 24,
              fontWeight: FontWeight.w700,
              color: _textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
              fontSize: 11,
              color: _textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildConditionChip(String label, Color color) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
      decoration: BoxDecoration(
        color: _cardBg.withAlpha(200),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withAlpha(30)),
      ),
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 14),
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 15,
              fontWeight: FontWeight.w500,
              color: _textPrimary,
            ),
          ),
          const Spacer(),
          Text(
            'Active',
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAllergyChip(String label) {
    return Container(
      padding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFFF6B6B).withAlpha(15),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
            color: const Color(0xFFFF6B6B).withAlpha(40)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.warning_amber_rounded,
              color: const Color(0xFFFF6B6B), size: 16),
          const SizedBox(width: 8),
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: const Color(0xFFFF6B6B),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTimelineItem({
    required String date,
    required String title,
    required String doctor,
    required String description,
    required IconData icon,
    required Color color,
    bool isFirst = false,
    bool isLast = false,
  }) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Timeline indicator
          SizedBox(
            width: 40,
            child: Column(
              children: [
                if (!isFirst)
                  Expanded(
                    flex: 0,
                    child: Container(
                      width: 2,
                      height: 12,
                      color: color.withAlpha(50),
                    ),
                  ),
                Container(
                  width: 16,
                  height: 16,
                  decoration: BoxDecoration(
                    color: color,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: color.withAlpha(80),
                        blurRadius: 8,
                      ),
                    ],
                  ),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 2,
                      color: color.withAlpha(30),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          // Content card
          Expanded(
            child: Container(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: _cardBg.withAlpha(200),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: color.withAlpha(25)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment:
                        MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          style: GoogleFonts.inter(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: _textPrimary,
                          ),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: color.withAlpha(15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          date,
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                            color: color,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    doctor,
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: _textSecondary,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    description,
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      height: 1.5,
                      color: _textSecondary.withAlpha(180),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMedicationCard({
    required String name,
    required String dosage,
    required String since,
    required IconData icon,
    required Color color,
  }) {
    return Container(
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
                  name,
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: _textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  dosage,
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    color: _textSecondary,
                  ),
                ),
              ],
            ),
          ),
          Text(
            since,
            style: GoogleFonts.inter(
              fontSize: 11,
              color: _textSecondary.withAlpha(120),
            ),
          ),
        ],
      ),
    );
  }
}
