
import 'package:flutter/material.dart';
import '../../services/ai_service.dart';
import 'package:google_fonts/google_fonts.dart';

class DoctorAssistantChatPage extends StatefulWidget {
  const DoctorAssistantChatPage({super.key});

  @override
  State<DoctorAssistantChatPage> createState() => _DoctorAssistantChatPageState();
}

class _DoctorAssistantChatPageState extends State<DoctorAssistantChatPage> {
  final TextEditingController _controller = TextEditingController();
  final List<Map<String, String>> _messages = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _messages.add({
      'role': 'assistant',
      'content': 'Hello Dr. I am your AI clinical assistant. '
                 'Ask me about patient psychology, report analysis, or differential diagnosis.'
    });
  }

  void _sendMessage() async {
    if (_controller.text.trim().isEmpty) return;

    final userMsg = _controller.text;
    setState(() {
      _messages.add({'role': 'user', 'content': userMsg});
      _isLoading = true;
    });
    _controller.clear();

    try {
      // Simulate AI response for now since we don't have a direct psychological endpoint in AiService,
      // but ideally we'd call AiService.chat(userMsg, context: 'psychology');
      await Future.delayed(const Duration(seconds: 1)); // Mock latency
      
      String aiResponse = "I can help analyze that. Based on common psychological patterns, "
          "patients exhibiting these signs might benefit from cognitive behavioral therapy. "
          "Please verify with clinical assessments.";

      // If implemented, we could call: final response = await AiService.getChatResponse(userMsg);
      // For now, let's just simulate a smart response or use a generic one if AiService isn't fully wired for this.
      
      setState(() {
        _messages.add({'role': 'assistant', 'content': aiResponse});
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _messages.add({'role': 'assistant', 'content': 'Error processing request.'});
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F0F23),
      appBar: AppBar(
        title: Text('AI Assistant', style: GoogleFonts.outfit(color: Colors.white)),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(20),
              itemCount: _messages.length,
              itemBuilder: (context, index) {
                final msg = _messages[index];
                final isUser = msg['role'] == 'user';
                return Align(
                  alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(16),
                    constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
                    decoration: BoxDecoration(
                      color: isUser ? const Color(0xFF3F8CFF) : const Color(0xFF1A1A3E),
                      borderRadius: BorderRadius.only(
                        topLeft: const Radius.circular(16),
                        topRight: const Radius.circular(16),
                        bottomLeft: isUser ? const Radius.circular(16) : Radius.zero,
                        bottomRight: isUser ? Radius.zero : const Radius.circular(16),
                      ),
                    ),
                    child: Text(
                      msg['content']!,
                      style: GoogleFonts.inter(color: Colors.white),
                    ),
                  ),
                );
              },
            ),
          ),
          if (_isLoading)
            const Padding(
              padding: EdgeInsets.all(8.0),
              child: LinearProgressIndicator(backgroundColor: Color(0xFF1A1A3E), color: Color(0xFF00D9A6)),
            ),
          Container(
            padding: const EdgeInsets.all(16),
            color: const Color(0xFF1A1A3E),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    style: GoogleFonts.inter(color: Colors.white),
                    decoration: InputDecoration(
                      hintText: 'Ask about a case...',
                      hintStyle: GoogleFonts.inter(color: Colors.white.withOpacity(0.5)),
                      border: InputBorder.none,
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.send_rounded, color: Color(0xFF3F8CFF)),
                  onPressed: _sendMessage,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
