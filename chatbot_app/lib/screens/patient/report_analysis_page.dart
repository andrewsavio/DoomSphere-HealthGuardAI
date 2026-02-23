import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:file_picker/file_picker.dart';
import '../../services/ai_service.dart';
import '../../services/medical_data_service.dart';

class ReportAnalysisPage extends StatefulWidget {
  const ReportAnalysisPage({super.key});

  @override
  State<ReportAnalysisPage> createState() => _ReportAnalysisPageState();
}

class _ReportAnalysisPageState extends State<ReportAnalysisPage> {
  static const _primaryGradientStart = Color(0xFF6C63FF);
  static const _primaryGradientEnd = Color(0xFF3F8CFF);
  static const _accentColor = Color(0xFF00D9A6);
  static const _darkBg = Color(0xFF0F0F23);
  static const _cardBg = Color(0xFF1A1A3E);
  static const _surfaceBg = Color(0xFF252550);
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
      String mimeType;
      switch (ext) {
        case 'jpg':
        case 'jpeg':
          mimeType = 'image/jpeg';
          break;
        case 'png':
          mimeType = 'image/png';
          break;
        case 'webp':
          mimeType = 'image/webp';
          break;
        case 'pdf':
          mimeType = 'application/pdf';
          break;
        default:
          mimeType = 'image/jpeg';
      }

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
      );

      setState(() {
        _analysisResult = analysis;
        _isAnalyzing = false;
      });

      // Saving report to persistence layer
      await MedicalDataService.saveReport(
        title: _uploadedFileName ?? 'Uploaded Report',
        analysisResult: analysis,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Report saved to Medical History'),
            backgroundColor: _accentColor,
            duration: Duration(seconds: 2),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception: ', '');
        _isAnalyzing = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Upload Section
          _buildUploadSection(),
          const SizedBox(height: 24),

          // Uploaded Image Preview
          if (_uploadedImageBytes != null) ...[
            _buildUploadedImagePreview(),
            const SizedBox(height: 24),
          ],

          // Error Message
          if (_errorMessage != null) ...[
            _buildErrorCard(),
            const SizedBox(height: 24),
          ],

          // Loading State
          if (_isAnalyzing) ...[
            _buildLoadingState(),
            const SizedBox(height: 24),
          ],

          // Analysis Results
          if (_analysisResult != null && !_isAnalyzing)
            _buildPatientView(),

          // Empty State
          if (_analysisResult == null && !_isAnalyzing && _errorMessage == null)
            _buildEmptyState(),
        ],
      ),
    );
  }

  Widget _buildUploadedImagePreview() {
    return Container(
      width: double.infinity,
      constraints: const BoxConstraints(maxHeight: 300),
      decoration: BoxDecoration(
        color: _cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _primaryGradientStart.withAlpha(50)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Image.memory(
            _uploadedImageBytes!,
            fit: BoxFit.contain,
            width: double.infinity,
          ),
          Positioned(
            top: 10,
            right: 10,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.black54,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                'Original Report',
                style: GoogleFonts.inter(
                  color: Colors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildUploadSection() {
    return GestureDetector(
      onTap: _isAnalyzing ? null : _pickAndAnalyzeReport,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(28),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(22),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              _primaryGradientStart.withAlpha(40),
              _primaryGradientEnd.withAlpha(25),
            ],
          ),
          border: Border.all(
            color: _primaryGradientStart.withAlpha(60),
            width: 1.5,
          ),
        ),
        child: Column(
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [_primaryGradientStart, _primaryGradientEnd],
                ),
                borderRadius: BorderRadius.circular(18),
                boxShadow: [
                  BoxShadow(
                    color: _primaryGradientStart.withAlpha(50),
                    blurRadius: 15,
                    offset: const Offset(0, 5),
                  ),
                ],
              ),
              child: const Icon(Icons.cloud_upload_rounded,
                  color: Colors.white, size: 30),
            ),
            const SizedBox(height: 16),
            Text(
              _uploadedFileName ?? 'Upload Medical Report',
              style: GoogleFonts.outfit(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: _textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _uploadedFileName != null
                  ? 'Tap to upload a different report'
                  : 'Supports JPG, PNG, WebP, PDF',
              style: GoogleFonts.inter(
                fontSize: 13,
                color: _textSecondary,
              ),
            ),
            const SizedBox(height: 16),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [_primaryGradientStart, _primaryGradientEnd],
                ),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(
                _isAnalyzing ? 'Analyzing...' : 'Choose File & Analyze',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLoadingState() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(40),
      decoration: BoxDecoration(
        color: _cardBg.withAlpha(200),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _accentColor.withAlpha(30)),
      ),
      child: Column(
        children: [
          SizedBox(
            width: 60,
            height: 60,
            child: CircularProgressIndicator(
              strokeWidth: 3,
              valueColor: const AlwaysStoppedAnimation<Color>(_accentColor),
              backgroundColor: _surfaceBg,
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'Analyzing Your Report',
            style: GoogleFonts.outfit(
              fontSize: 20,
              fontWeight: FontWeight.w600,
              color: _textPrimary,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'Zenova AI is extracting clinical parameters,\nmapping reference ranges, and generating insights...',
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
              fontSize: 13,
              color: _textSecondary,
              height: 1.6,
            ),
          ),
          const SizedBox(height: 20),
          // Animated steps
          _buildLoadingStep('Extracting parameters', true),
          _buildLoadingStep('Analyzing reference ranges', true),
          _buildLoadingStep('Generating patient summary', false),
          _buildLoadingStep('Preparing clinical insights', false),
        ],
      ),
    );
  }

  Widget _buildLoadingStep(String label, bool completed) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(
            completed
                ? Icons.check_circle_rounded
                : Icons.radio_button_unchecked_rounded,
            color: completed ? _accentColor : _textSecondary.withAlpha(60),
            size: 18,
          ),
          const SizedBox(width: 12),
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 13,
              color: completed ? _accentColor : _textSecondary.withAlpha(100),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFFFF6B6B).withAlpha(15),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFF6B6B).withAlpha(40)),
      ),
      child: Row(
        children: [
          Icon(Icons.error_outline_rounded,
              color: const Color(0xFFFF6B6B), size: 24),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              _errorMessage!,
              style: GoogleFonts.inter(
                fontSize: 14,
                color: const Color(0xFFFF6B6B),
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ─── Patient View ──────────────────────────────────────────────────

  Widget _buildPatientView() {
    final summary = _analysisResult?['patientSummary'] as Map<String, dynamic>? ?? {};
    final parameters = (_analysisResult?['parameters'] as List<dynamic>?) ?? [];
    final title = _analysisResult?['reportTitle'] ?? 'Report Analysis';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Report title
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [_accentColor, _accentColor.withAlpha(180)],
            ),
            borderRadius: BorderRadius.circular(18),
            boxShadow: [
              BoxShadow(
                color: _accentColor.withAlpha(40),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title.toString(),
                style: GoogleFonts.outfit(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: _darkBg,
                ),
              ),
              if (_analysisResult?['dateDetected'] != null) ...[
                const SizedBox(height: 4),
                Text(
                  _analysisResult!['dateDetected'].toString(),
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    color: _darkBg.withAlpha(160),
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 20),

        // Overview
        if (summary['overview'] != null) ...[
          _buildSectionLabel('📋 Overview'),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: _cardBg.withAlpha(200),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: _accentColor.withAlpha(25)),
            ),
            child: Text(
              summary['overview'].toString(),
              style: GoogleFonts.inter(
                fontSize: 14,
                height: 1.6,
                color: _textPrimary,
              ),
            ),
          ),
          const SizedBox(height: 20),
        ],

        // Key Findings (moved up)
        if (summary['keyFindings'] is List &&
            (summary['keyFindings'] as List).isNotEmpty) ...[
          _buildSectionLabel('🔍 Key Findings'),
          const SizedBox(height: 12),
          ...(summary['keyFindings'] as List).map(
            (f) => _buildFindingItem(f.toString()),
          ),
          const SizedBox(height: 20),
        ],

        // Risk Indicators (moved up)
        if (summary['riskIndicators'] is List &&
            (summary['riskIndicators'] as List).isNotEmpty) ...[
          _buildSectionLabel('⚠️ Risk Indicators'),
          const SizedBox(height: 12),
          ...(summary['riskIndicators'] as List).map(
            (r) => _buildRiskIndicator(r as Map<String, dynamic>),
          ),
          const SizedBox(height: 20),
        ],

        // Next Steps (moved up)
        if (summary['nextSteps'] is List &&
            (summary['nextSteps'] as List).isNotEmpty) ...[
          _buildSectionLabel('➡️ Recommended Next Steps'),
          const SizedBox(height: 12),
          ...(summary['nextSteps'] as List).asMap().entries.map(
                (e) => _buildNextStepItem(e.key + 1, e.value.toString()),
              ),
          const SizedBox(height: 20),
        ],

        // Reassurance
        if (summary['reassurance'] != null &&
            summary['reassurance'].toString().isNotEmpty) ...[
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: _accentColor.withAlpha(12),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: _accentColor.withAlpha(30)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.favorite_rounded,
                    color: _accentColor, size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    summary['reassurance'].toString(),
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      height: 1.5,
                      color: _accentColor,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
        ],

        // Test Results (moved down — detailed data)
        if (parameters.isNotEmpty) ...[
          _buildSectionLabel('🔬 Detailed Test Results'),
          const SizedBox(height: 12),
          ...parameters.map((p) => _buildParameterCard(p as Map<String, dynamic>)),
          const SizedBox(height: 20),
        ],

        // Disclaimer
        _buildDisclaimer(),
        const SizedBox(height: 20),
      ],
    );
  }



  // ─── Shared Builder Helpers ────────────────────────────────────────

  Widget _buildSectionLabel(String label) {
    return Text(
      label,
      style: GoogleFonts.outfit(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        color: _textPrimary,
      ),
    );
  }

  Widget _buildParameterCard(Map<String, dynamic> param) {
    final status = (param['status'] ?? 'normal').toString().toLowerCase();
    Color statusColor;
    switch (status) {
      case 'high':
        statusColor = const Color(0xFFFF9F43);
        break;
      case 'low':
        statusColor = _primaryGradientEnd;
        break;
      case 'critical':
        statusColor = const Color(0xFFFF6B6B);
        break;
      default:
        statusColor = _accentColor;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _cardBg.withAlpha(200),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: statusColor.withAlpha(30)),
      ),
      child: Row(
        children: [
          Container(
            width: 6,
            height: 40,
            decoration: BoxDecoration(
              color: statusColor,
              borderRadius: BorderRadius.circular(3),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  param['name']?.toString() ?? '',
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: _textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Ref: ${param['referenceRange'] ?? 'N/A'}',
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: _textSecondary,
                  ),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${param['value'] ?? ''} ${param['unit'] ?? ''}',
                style: GoogleFonts.outfit(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: statusColor,
                ),
              ),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 10, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withAlpha(15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  status.toUpperCase(),
                  style: GoogleFonts.inter(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: statusColor,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }


  Widget _buildFindingItem(String finding) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _cardBg.withAlpha(200),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.check_circle_rounded, color: _accentColor, size: 18),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              finding,
              style: GoogleFonts.inter(
                fontSize: 14,
                height: 1.5,
                color: _textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRiskIndicator(Map<String, dynamic> risk) {
    final level = (risk['level'] ?? 'low').toString().toLowerCase();
    Color color;
    switch (level) {
      case 'high':
      case 'critical':
        color = const Color(0xFFFF6B6B);
        break;
      case 'moderate':
        color = const Color(0xFFFF9F43);
        break;
      default:
        color = _accentColor;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withAlpha(10),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withAlpha(30)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: color.withAlpha(20),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              level == 'low'
                  ? Icons.shield_rounded
                  : Icons.warning_rounded,
              color: color,
              size: 22,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      risk['label']?.toString() ?? '',
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: _textPrimary,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: color.withAlpha(20),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        level.toUpperCase(),
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: color,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  risk['explanation']?.toString() ?? '',
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    height: 1.4,
                    color: _textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNextStepItem(int number, String step) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _cardBg.withAlpha(200),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [_primaryGradientStart, _primaryGradientEnd],
              ),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Center(
              child: Text(
                '$number',
                style: GoogleFonts.outfit(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              step,
              style: GoogleFonts.inter(
                fontSize: 14,
                height: 1.4,
                color: _textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }


  Widget _buildDisclaimer() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _surfaceBg.withAlpha(100),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _textSecondary.withAlpha(15)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.info_outline_rounded,
              color: _textSecondary.withAlpha(100), size: 16),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'This AI analysis is a clinical decision-support tool, not a diagnostic replacement. Always consult with a qualified healthcare professional for medical decisions.',
              style: GoogleFonts.inter(
                fontSize: 11,
                height: 1.5,
                color: _textSecondary.withAlpha(120),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 50),
      child: Column(
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: _surfaceBg,
              borderRadius: BorderRadius.circular(24),
            ),
            child: Icon(Icons.biotech_rounded,
                color: _textSecondary.withAlpha(80), size: 40),
          ),
          const SizedBox(height: 20),
          Text(
            'No Reports Analyzed Yet',
            style: GoogleFonts.outfit(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: _textSecondary,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Upload a medical report above to get\nAI-powered analysis in simple words',
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
              fontSize: 14,
              color: _textSecondary.withAlpha(120),
              height: 1.5,
            ),
          ),
          const SizedBox(height: 20),
          if (!AiService.isConfigured)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFFF6B6B).withAlpha(12),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFFF6B6B).withAlpha(30)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.error_outline_rounded,
                      color: Color(0xFFFF6B6B), size: 16),
                  const SizedBox(width: 8),
                  Text(
                    'AI not configured — add GROQ_API_KEY to .env file',
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      color: const Color(0xFFFF6B6B),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
