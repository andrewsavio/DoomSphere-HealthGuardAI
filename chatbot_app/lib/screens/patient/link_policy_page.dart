
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class LinkPolicyPage extends StatefulWidget {
  const LinkPolicyPage({super.key});

  @override
  State<LinkPolicyPage> createState() => _LinkPolicyPageState();
}

class _LinkPolicyPageState extends State<LinkPolicyPage> {
  final _formKey = GlobalKey<FormState>();
  final _policyNumberController = TextEditingController();
  final _holderNameController = TextEditingController();
  
  String _selectedProvider = 'HDFC Ergo';
  final List<String> _providers = [
    'HDFC Ergo',
    'Niva Bupa',
    'Star Health',
    'Care Insurance',
    'ICICI Lombard',
    'Bajaj Allianz',
    'Tata AIG',
    'Aditya Birla Health',
    'Acko General Insurance',
    'Reliance General',
  ];

  bool _isLinking = false;

  void _linkPolicy() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLinking = true);

    // Simulate API call
    await Future.delayed(const Duration(seconds: 2));

    if (mounted) {
      setState(() => _isLinking = false);
      
      // Show success dialog
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          backgroundColor: const Color(0xFF1A1A3E),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Row(
            children: [
              const Icon(Icons.check_circle_rounded, color: Color(0xFF00D9A6), size: 28),
              const SizedBox(width: 12),
              Text('Policy Linked!', style: GoogleFonts.outfit(color: Colors.white)),
            ],
          ),
          content: Text(
            'Your health insurance policy has been successfully verified and linked to your account.',
            style: GoogleFonts.inter(color: const Color(0xFFB0B0D0)),
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(context); // Close dialog
                Navigator.pop(context); // Go back to insurance list
              },
              child: Text('Done', style: GoogleFonts.inter(color: const Color(0xFF00D9A6))),
            ),
          ],
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F0F23),
      appBar: AppBar(
        title: Text('Link Health Policy', style: GoogleFonts.outfit(color: Colors.white)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Connect Insurance',
                style: GoogleFonts.outfit(
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Enter your policy details to track coverage and claims automatically.',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  color: const Color(0xFFB0B0D0),
                ),
              ),
              const SizedBox(height: 32),

              // Provider Dropdown
              Text(
                'Insurance Provider',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(
                  color: const Color(0xFF252550),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white.withOpacity(0.1)),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _selectedProvider,
                    isExpanded: true,
                    dropdownColor: const Color(0xFF252550),
                    icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFFB0B0D0)),
                    items: _providers.map((String provider) {
                      return DropdownMenuItem<String>(
                        value: provider,
                        child: Text(
                          provider,
                          style: GoogleFonts.inter(color: Colors.white),
                        ),
                      );
                    }).toList(),
                    onChanged: (val) => setState(() => _selectedProvider = val!),
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Policy Number Input
              _buildTextField(
                controller: _policyNumberController,
                label: 'Policy Number',
                hint: 'e.g., P-12345678-01',
                icon: Icons.numbers_rounded,
                validator: (v) => v!.isEmpty ? 'Please enter policy number' : null,
              ),
              const SizedBox(height: 24),

              // Policy Holder Name
              _buildTextField(
                controller: _holderNameController,
                label: 'Policy Holder Name',
                hint: 'Name as on policy document',
                icon: Icons.person_outline_rounded,
                validator: (v) => v!.isEmpty ? 'Please enter holder name' : null,
              ),

              const SizedBox(height: 40),

              // Submit Button
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: _isLinking ? null : _linkPolicy,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF00D9A6),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    elevation: 0,
                  ),
                  child: _isLinking
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : Text(
                          'Link Policy',
                          style: GoogleFonts.inter(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: Colors.black,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 20),
              
              Center(
                child: TextButton.icon(
                  onPressed: () {
                    // TODO: Implement scan via camera
                  },
                  icon: const Icon(Icons.qr_code_scanner_rounded, size: 18),
                  label: const Text('Scan Policy Document'),
                  style: TextButton.styleFrom(
                    foregroundColor: const Color(0xFF6C63FF),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    required String? Function(String?) validator,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          validator: validator,
          style: GoogleFonts.inter(color: Colors.white),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: GoogleFonts.inter(color: const Color(0xFFB0B0D0).withOpacity(0.5)),
            prefixIcon: Icon(icon, color: const Color(0xFFB0B0D0)),
            filled: true,
            fillColor: const Color(0xFF252550),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFF6C63FF)),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Colors.redAccent),
            ),
          ),
        ),
      ],
    );
  }
}
