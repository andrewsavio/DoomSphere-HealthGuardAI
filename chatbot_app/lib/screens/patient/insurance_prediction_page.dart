
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class InsurancePredictionPage extends StatefulWidget {
  const InsurancePredictionPage({super.key});

  @override
  State<InsurancePredictionPage> createState() => _InsurancePredictionPageState();
}

class _InsurancePredictionPageState extends State<InsurancePredictionPage> {
  // Theme constants
  static const _primaryGradientStart = Color(0xFF6C63FF);
  static const _primaryGradientEnd = Color(0xFF3F8CFF);
  static const _accentColor = Color(0xFF00D9A6);
  static const _darkBg = Color(0xFF0F0F23);
  static const _cardBg = Color(0xFF1A1A3E);
  static const _surfaceBg = Color(0xFF252550);
  static const _textPrimary = Color(0xFFFFFFFF);
  static const _textSecondary = Color(0xFFB0B0D0);

  // Form State
  int _age = 25;
  String _incomeRange = '₹5L - ₹10L';
  String _cityTier = 'Tier 1 (Metro)';
  String _employmentType = 'Salaried';
  List<String> _familyMembers = ['Self'];
  List<String> _medicalConditions = [];
  
  bool _isAnalyzing = false;
  Map<String, dynamic>? _recommendation;

  final List<String> _incomeRanges = [
    '< ₹5L',
    '₹5L - ₹10L',
    '₹10L - ₹20L',
    '> ₹20L'
  ];

  final List<String> _cityTiers = [
    'Tier 1 (Metro)',
    'Tier 2 (Urban)',
    'Tier 3 (Semi-Urban)'
  ];

  final List<String> _employmentTypes = [
    'Salaried',
    'Self-Employed',
    'Freelancer/Other'
  ];

  final List<String> _conditionsList = [
    'Diabetes',
    'Hypertension',
    'Heart Condition',
    'Thyroid',
    'Asthma',
    'None'
  ];

  void _analyzeAndPredict() async {
    setState(() {
      _isAnalyzing = true;
      _recommendation = null;
    });

    // Simulate AI delay
    await Future.delayed(const Duration(seconds: 2));

    // Simple Rule-Based Logic for "Prediction" (Indian Context)
    
    // 1. Determine Sum Insured based on City & Income
    String suggestedCover = '₹5 Lakhs';
    if (_cityTier.contains('Tier 1')) {
      suggestedCover = '₹10 Lakhs - ₹15 Lakhs';
      if (_incomeRange == '> ₹20L') suggestedCover = '₹25 Lakhs - ₹1 Crore';
    } else if (_cityTier.contains('Tier 2')) {
      suggestedCover = '₹7 Lakhs - ₹10 Lakhs';
    }

    // 2. Policy Type
    String policyType = 'Individual Health Plan';
    if (_familyMembers.length > 1) {
      policyType = 'Family Floater Plan';
      if (_familyMembers.contains('Parents')) {
        policyType = 'Family Floater + Senior Citizen Add-on';
      }
    }

    // 3. Estimated Premium (Rough Logic)
    int basePremium = 5000;
    if (_age > 30) basePremium += 2000;
    if (_age > 45) basePremium += 5000;
    if (_familyMembers.length > 1) basePremium += 3000 * (_familyMembers.length - 1);
    if (_medicalConditions.isNotEmpty && !_medicalConditions.contains('None')) {
      basePremium += 4000; // Load for conditions
    }
    
    // 4. Suggested Insurers (Illustrative)
    List<String> insurers = ['HDFC Ergo', 'Niva Bupa', 'Star Health', 'Care Insurance'];
    if (_incomeRange == '< ₹5L') {
       insurers = ['Ayushman Bharat (Govt)', 'Arogya Sanjeevani (Standard)'];
    }

    setState(() {
      _isAnalyzing = false;
      _recommendation = {
        'planName': _incomeRange == '< ₹5L' ? 'Essential Care' : 'Comprehensive Shield',
        'type': policyType,
        'cover': suggestedCover,
        'premium': '₹$basePremium - ₹${(basePremium * 1.3).round()} / year',
        'insurers': insurers,
        'features': [
          _cityTier.contains('Tier 1') ? 'No Room Rent Capping' : 'Cost-Effective Network',
          'Cashless Treatment',
          if (_medicalConditions.isNotEmpty) 'Pre-existing Disease Cover (Waiting Period Apply)',
          'Free Annual Health Check-up',
          'AYUSH Treatment Covered'
        ]
      };
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _darkBg,
      appBar: AppBar(
        title: Text('AI Policy Predictor', style: GoogleFonts.outfit(color: _textPrimary)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: _textSecondary),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "Find Your Perfect Shield 🛡️",
              style: GoogleFonts.outfit(
                fontSize: 24,
                fontWeight: FontWeight.w700,
                color: _textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              "Tell us a bit about yourself to get tailored insurance recommendations.",
              style: GoogleFonts.inter(
                fontSize: 14,
                color: _textSecondary,
              ),
            ),
            const SizedBox(height: 24),
            
            // Age Slider
            _buildSectionTitle('How old is the eldest member?'),
            Row(
              children: [
                Expanded(
                  child: Slider(
                    value: _age.toDouble(),
                    min: 18,
                    max: 80,
                    activeColor: _accentColor,
                    inactiveColor: _surfaceBg,
                    onChanged: (val) => setState(() => _age = val.round()),
                  ),
                ),
                Text(
                  '$_age Years',
                  style: GoogleFonts.outfit(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: _accentColor,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Family Members
            _buildSectionTitle('Who do you want to insure?'),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: ['Self', 'Spouse', 'Children', 'Parents'].map((member) {
                final isSelected = _familyMembers.contains(member);
                return FilterChip(
                  label: Text(member),
                  selected: isSelected,
                  onSelected: (selected) {
                    setState(() {
                      if (selected) {
                        _familyMembers.add(member);
                      } else if (member != 'Self') { // Prevent removing Self
                        _familyMembers.remove(member);
                      }
                    });
                  },
                  backgroundColor: _surfaceBg,
                  selectedColor: _primaryGradientStart.withAlpha(100),
                  checkmarkColor: Colors.white,
                  labelStyle: GoogleFonts.inter(
                    color: isSelected ? Colors.white : _textSecondary,
                  ),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  side: BorderSide.none,
                );
              }).toList(),
            ),
            const SizedBox(height: 20),

            // City Tier
            _buildSectionTitle('Which city do you live in?'),
            _buildDropdown(_cityTiers, _cityTier, (val) => setState(() => _cityTier = val!)),
            const SizedBox(height: 16),

            // Income Range
            _buildSectionTitle('Annual Family Income'),
            _buildDropdown(_incomeRanges, _incomeRange, (val) => setState(() => _incomeRange = val!)),
             const SizedBox(height: 16),
            
            // Medical Conditions
            _buildSectionTitle('Any existing medical conditions?'),
             Wrap(
              spacing: 10,
              runSpacing: 10,
              children: _conditionsList.map((condition) {
                final isSelected = _medicalConditions.contains(condition);
                return FilterChip(
                  label: Text(condition),
                  selected: isSelected,
                  onSelected: (selected) {
                    setState(() {
                      if (selected) {
                        if (condition == 'None') {
                          _medicalConditions.clear();
                          _medicalConditions.add('None');
                        } else {
                          _medicalConditions.remove('None');
                          _medicalConditions.add(condition);
                        }
                      } else {
                        _medicalConditions.remove(condition);
                      }
                    });
                  },
                  backgroundColor: _surfaceBg,
                  selectedColor: const Color(0xFFFF6B6B).withAlpha(100), // Alert color for conditions
                  checkmarkColor: Colors.white,
                  labelStyle: GoogleFonts.inter(
                    color: isSelected ? Colors.white : _textSecondary,
                  ),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  side: BorderSide.none,
                );
              }).toList(),
            ),

            const SizedBox(height: 32),

            // Analyze Button
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton(
                onPressed: _isAnalyzing ? null : _analyzeAndPredict,
                style: ElevatedButton.styleFrom(
                  padding: EdgeInsets.zero,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  elevation: 0,
                  backgroundColor: Colors.transparent,
                ),
                child: Ink(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    gradient: const LinearGradient(
                      colors: [_primaryGradientStart, _primaryGradientEnd],
                    ),
                  ),
                  child: Container(
                    alignment: Alignment.center,
                    child: _isAnalyzing
                        ? const CircularProgressIndicator(color: Colors.white)
                        : Text(
                            'Predict Best Policy',
                            style: GoogleFonts.inter(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: Colors.white,
                            ),
                          ),
                  ),
                ),
              ),
            ),

            const SizedBox(height: 32),

            // Recommendation Result
            if (_recommendation != null) _buildRecommendationCard(),
             const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Text(
        title,
        style: GoogleFonts.inter(
          fontSize: 15,
          fontWeight: FontWeight.w600,
          color: _textPrimary,
        ),
      ),
    );
  }

  Widget _buildDropdown(List<String> items, String currentValue, Function(String?) onChanged) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: _surfaceBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _textSecondary.withAlpha(30)),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: currentValue,
          isExpanded: true,
          dropdownColor: _cardBg,
          icon: const Icon(Icons.keyboard_arrow_down_rounded, color: _textSecondary),
          items: items.map((String item) {
            return DropdownMenuItem<String>(
              value: item,
              child: Text(
                item,
                style: GoogleFonts.inter(fontSize: 15, color: _textPrimary),
              ),
            );
          }).toList(),
          onChanged: onChanged,
        ),
      ),
    );
  }

  Widget _buildRecommendationCard() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: _cardBg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _accentColor.withAlpha(60)),
        boxShadow: [
          BoxShadow(
            color: _accentColor.withAlpha(20),
            blurRadius: 30,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'AI RECOMMENDED PLAN',
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: _accentColor,
                  letterSpacing: 1.2,
                ),
              ),
              const Icon(Icons.verified_user_rounded, color: _accentColor),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            _recommendation!['planName'],
            style: GoogleFonts.outfit(
              fontSize: 24,
              fontWeight: FontWeight.w700,
              color: _textPrimary,
            ),
          ),
           Text(
            _recommendation!['type'],
            style: GoogleFonts.inter(
              fontSize: 15,
              color: _textSecondary,
            ),
          ),
          const SizedBox(height: 20),
          Divider(color: _textSecondary.withAlpha(30)),
           const SizedBox(height: 20),
          
          _buildResultRow('Recommended Cover', _recommendation!['cover']),
          const SizedBox(height: 12),
          _buildResultRow('Est. Premium', _recommendation!['premium']),
          
          const SizedBox(height: 24),
           Text(
            'Suggested Insurers:',
            style: GoogleFonts.inter(fontSize: 14, color: _textSecondary),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: (_recommendation!['insurers'] as List<String>).map((insurer) {
              return Chip(
                label: Text(insurer),
                backgroundColor: _surfaceBg,
                labelStyle: GoogleFonts.inter(fontSize: 12, color: _textPrimary),
                padding: EdgeInsets.zero,
                visualDensity: VisualDensity.compact,
              );
            }).toList(),
          ),

           const SizedBox(height: 20),
           Text(
            'Key Features:',
            style: GoogleFonts.inter(fontSize: 14, color: _textSecondary),
          ),
          const SizedBox(height: 8),
          ...(_recommendation!['features'] as List<String>).map((feature) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  const Icon(Icons.check_circle_rounded, color: _accentColor, size: 16),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      feature,
                      style: GoogleFonts.inter(fontSize: 13, color: _textPrimary),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildResultRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: GoogleFonts.inter(fontSize: 14, color: _textSecondary),
        ),
        Text(
          value,
          style: GoogleFonts.outfit(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: _textPrimary,
          ),
        ),
      ],
    );
  }
}
