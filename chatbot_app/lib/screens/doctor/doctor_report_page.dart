
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:file_picker/file_picker.dart';
import '../../services/ai_service.dart';

class DoctorReportPage extends StatefulWidget {
  const DoctorReportPage({super.key});

  @override
  State<DoctorReportPage> createState() => _DoctorReportPageState();
}

class _DoctorReportPageState extends State<DoctorReportPage> {
  static const _primaryGradientStart = Color(0xFF6C63FF);
  static const _primaryGradientEnd = Color(0xFF3F8CFF);
  static const _accentColor = Color(0xFF00D9A6);
  static const _darkBg = Color(0xFF0F0F23);
  static const _cardBg = Color(0xFF1A1A3E);
  static const _textPrimary = Color(0xFFFFFFFF);
  static const _textSecondary = Color(0xFFB0B0D0);

  bool _isAnalyzing = false;
  Map<String, dynamic>? _analysisResult;
  String? _errorMessage;
  Uint8List? _uploadedImageBytes;
  String? _uploadedFileName;

  Future<void> _pickAndAnalyzeReport() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
        withData: true,
      );

      if (result == null || result.files.isEmpty) return;

      final file = result.files.first;
      if (file.bytes == null) {
        setState(() => _errorMessage = 'Could not read file data.');
        return;
      }

      final ext = file.extension?.toLowerCase() ?? '';
      String mimeType = (ext == 'png') ? 'image/png' : 'image/jpeg';
      if (ext == 'webp') mimeType = 'image/webp';
      if (ext == 'pdf') mimeType = 'application/pdf';

      setState(() {
        _isAnalyzing = true;
        _errorMessage = null;
        _analysisResult = null;
        _uploadedImageBytes = file.bytes;
        _uploadedFileName = file.name;
      });

      final analysis = await AiService.analyzeReport(
        imageBytes: file.bytes!,
        mimeType: mimeType,
        audience: 'doctor', // Requesting doctor-specific analysis
      );

      setState(() {
        _analysisResult = analysis;
        _isAnalyzing = false;
      });

    } catch (e) {
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception: ', '');
        _isAnalyzing = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _darkBg,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('Clinical Analysis', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildUploadSection(),
            const SizedBox(height: 20),
            if (_isAnalyzing) _buildLoadingState(),
            if (_errorMessage != null) _buildErrorCard(),
            if (_analysisResult != null) _buildClinicalView(),
          ],
        ),
      ),
    );
  }

  Widget _buildUploadSection() {
    return GestureDetector(
      onTap: _isAnalyzing ? null : _pickAndAnalyzeReport,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: _cardBg.withOpacity(0.5),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _primaryGradientStart.withOpacity(0.3)),
        ),
        child: Column(
          children: [
            Icon(Icons.upload_file_rounded, size: 40, color: _primaryGradientEnd),
            const SizedBox(height: 12),
            Text(
              _uploadedFileName ?? 'Upload Report for Analysis',
              style: GoogleFonts.outfit(fontSize: 16, color: _textPrimary),
            ),
            if (_uploadedFileName == null)
              Text(
                'Supports JPG, PNG, PDF',
                style: GoogleFonts.inter(fontSize: 12, color: _textSecondary),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildLoadingState() {
    return Center(
      child: Column(
        children: [
          const CircularProgressIndicator(color: _accentColor),
          const SizedBox(height: 16),
          Text(
            'Analyzing clinical parameters...',
            style: GoogleFonts.inter(color: _textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.redAccent.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.redAccent.withOpacity(0.3)),
      ),
      child: Text(_errorMessage!, style: GoogleFonts.inter(color: Colors.redAccent)),
    );
  }

  Widget _buildClinicalView() {
    final doctorSummary = _analysisResult?['doctorSummary'] as Map<String, dynamic>? ?? {};
    final parameters = _analysisResult?['parameters'] as List<dynamic>? ?? [];
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionHeader('Clinical Synthesis'),
        _buildContentCard(doctorSummary['clinicalOverview']?.toString() ?? 'No overview available.'),
        
        const SizedBox(height: 20),
        _buildSectionHeader('Differential Diagnosis'),
        if (doctorSummary['differentialConsiderations'] is List)
          ...((doctorSummary['differentialConsiderations'] as List).map((e) => _buildBulletPoint(e.toString()))),

        const SizedBox(height: 20),
        _buildSectionHeader('Abnormalities'),
        if (doctorSummary['abnormalities'] is List)
          ...((doctorSummary['abnormalities'] as List).map((e) => _buildBulletPoint(e.toString(), isAlert: true))),

        const SizedBox(height: 20),
        _buildSectionHeader('Detailed Parameters'),
        ...parameters.map((p) => _buildParameterRow(p as Map<String, dynamic>)),
      ],
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(
        title,
        style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w600, color: _accentColor),
      ),
    );
  }

  Widget _buildContentCard(String content) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _cardBg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        content,
        style: GoogleFonts.inter(fontSize: 14, height: 1.5, color: _textSecondary),
      ),
    );
  }

  Widget _buildBulletPoint(String text, {bool isAlert = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            isAlert ? Icons.warning_amber_rounded : Icons.arrow_right_rounded,
            color: isAlert ? Colors.orangeAccent : _primaryGradientEnd,
            size: 20,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: GoogleFonts.inter(fontSize: 14, color: _textPrimary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildParameterRow(Map<String, dynamic> param) {
    final status = param['status']?.toString().toLowerCase() ?? 'normal';
    final isAbnormal = status != 'normal';
    
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isAbnormal ? Colors.orangeAccent.withOpacity(0.1) : _cardBg.withOpacity(0.5),
        borderRadius: BorderRadius.circular(8),
        border: isAbnormal ? Border.all(color: Colors.orangeAccent.withOpacity(0.3)) : null,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(param['name'] ?? '', style: GoogleFonts.inter(fontWeight: FontWeight.w500, color: _textPrimary)),
                Text('Ref: ${param['referenceRange'] ?? 'N/A'}', style: GoogleFonts.inter(fontSize: 12, color: _textSecondary)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('${param['value']} ${param['unit']}', style: GoogleFonts.outfit(fontWeight: FontWeight.w700, color: isAbnormal ? Colors.orangeAccent : _accentColor)),
              if (isAbnormal)
                Text(status.toUpperCase(), style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.orangeAccent)),
            ],
          ),
        ],
      ),
    );
  }
}
