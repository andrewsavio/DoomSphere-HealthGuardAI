import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'screens/login_page.dart';
import 'screens/doctor_profile_page.dart';
import 'screens/patient_profile_page.dart';
import 'services/ai_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Load environment variables
  await dotenv.load(fileName: ".env");

  // Configure AI service with API key from .env
  final groqKey = dotenv.env['GROQ_API_KEY'] ?? '';
  if (groqKey.isNotEmpty && groqKey != 'gsk_your_api_key_here') {
    AiService.setApiKey(groqKey);
  }

  // Supabase Config
  final supabaseUrl = dotenv.env['SUPABASE_URL'] ?? '';
  final supabaseKey = dotenv.env['SUPABASE_ANON_KEY'] ?? '';

  if (supabaseUrl.isNotEmpty && supabaseKey.isNotEmpty && !supabaseUrl.contains('YOUR_SUPABASE')) {
    await Supabase.initialize(
      url: supabaseUrl,
      anonKey: supabaseKey,
    );
  } else {
    // Fallback or development mode
    debugPrint('Warning: Supabase keys not found in .env');
    // Initialize with placeholders to prevent crash, but calls will fail
    await Supabase.initialize(
      url: 'https://placeholder.supabase.co',
      anonKey: 'placeholder',
    );
  }

  runApp(const ZenovaApp());
}

class ZenovaApp extends StatelessWidget {
  const ZenovaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Zenova',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF6C63FF),
          brightness: Brightness.dark,
        ),
        textTheme: GoogleFonts.interTextTheme(
          ThemeData.dark().textTheme,
        ),
      ),
      home: _getInitialPage(),
    );
  }

  /// Check if user is already signed in and route accordingly
  Widget _getInitialPage() {
    return const PatientProfilePage();
  }
}
