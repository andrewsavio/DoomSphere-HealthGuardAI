import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../services/medical_data_service.dart';
import '../../services/ai_service.dart';

class AiChatPage extends StatefulWidget {
  const AiChatPage({super.key});

  @override
  State<AiChatPage> createState() => _AiChatPageState();
}

class _AiChatPageState extends State<AiChatPage> {
  static const _primaryGradientStart = Color(0xFF6C63FF);
  // ... (color constants are fine)
  static const _primaryGradientEnd = Color(0xFF3F8CFF);
  static const _accentColor = Color(0xFF00D9A6);
  static const _cardBg = Color(0xFF1A1A3E);
  static const _surfaceBg = Color(0xFF252550);
  static const _textPrimary = Color(0xFFFFFFFF);
  static const _textSecondary = Color(0xFFB0B0D0);

  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final List<_ChatMessage> _messages = [];
  bool _isTyping = false;
  final FocusNode _focusNode = FocusNode();
  String _medicalContext = ''; 
  String _selectedLanguage = 'English';
  final List<String> _languages = ['English', 'Tamil'];

  final List<String> _quickActions = [
    '💊 Explain my medication',
    '🩸 What does my blood test mean?',
    '🏃 Wellness tips for today',
    '😰 I\'m feeling anxious about my health',
    '📋 Help me prepare for my appointment',
    '🍎 Diet recommendations',
  ];

  @override
  void initState() {
    super.initState();
    _loadMedicalContext(); // Load context on init
    
    // Add welcome message
    _messages.add(_ChatMessage(
      text:
          'Hello! I\'m **Zenova AI**, your personal healthcare assistant. 👋\n\n'
          'I can help you:\n'
          '• Understand medical reports and lab results\n'
          '• Explain medications and their effects\n'
          '• Provide wellness and lifestyle tips\n'
          '• Answer health-related questions\n\n'
          'How can I assist you today?',
      isUser: false,
      timestamp: DateTime.now(),
    ));
  }

  Future<void> _loadMedicalContext() async {
    final context = await MedicalDataService.getMedicalContextForChat();
    setState(() {
      _medicalContext = context;
    });
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  Future<void> _sendMessage(String text) async {
    if (text.trim().isEmpty) return;

    final userMessage = _ChatMessage(
      text: text.trim(),
      isUser: true,
      timestamp: DateTime.now(),
    );

    setState(() {
      _messages.add(userMessage);
      _isTyping = true;
      _messageController.clear();
    });

    _scrollToBottom();

    try {
      // Build history from past messages (skip welcome)
      final history = _messages
          .skip(1)
          .where((m) => m.text.isNotEmpty)
          .map((m) => {
                'role': m.isUser ? 'user' : 'assistant',
                'content': m.text,
              })
          .toList();

      // Remove the latest user message from history since we pass it separately
      if (history.isNotEmpty) history.removeLast();
      
      // Prepend medical context to the first system message or logical start
      // Check if context is already added to history or if we need to add it now
      // Since AiService.chat adds a system prompt, we can add this context as a hidden
      // system message in the history list to provide context to the LLM.
      
      final contextMessage = {
        'role': 'system',
        'content': 'Background Information for this user:\n$_medicalContext'
      };
      
      // Insert at the beginning of history so AI sees it
      history.insert(0, contextMessage);

      final response = await AiService.chat(
        message: text.trim(),
        history: history,
        userLanguage: _selectedLanguage,
      );

      setState(() {
        _messages.add(_ChatMessage(
          text: response,
          isUser: false,
          timestamp: DateTime.now(),
        ));
        _isTyping = false;
      });
    } catch (e) {
      setState(() {
        _messages.add(_ChatMessage(
          text:
              '⚠️ ${e.toString().replaceAll('Exception: ', '')}',
          isUser: false,
          timestamp: DateTime.now(),
          isError: true,
        ));
        _isTyping = false;
      });
    }

    _scrollToBottom();
  }

  void _scrollToBottom() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Language Selector
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          color: _cardBg.withAlpha(50),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Chat Language',
                style: GoogleFonts.inter(
                  color: _textSecondary,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(
                  color: _surfaceBg,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: _primaryGradientStart.withAlpha(30)),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _selectedLanguage,
                    icon: const Icon(Icons.arrow_drop_down, color: _accentColor),
                    style: GoogleFonts.inter(
                      color: _textPrimary,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                    dropdownColor: _cardBg,
                    isDense: true,
                    items: _languages.map((String lang) {
                      return DropdownMenuItem<String>(
                        value: lang,
                        child: Text(lang),
                      );
                    }).toList(),
                    onChanged: (String? newValue) {
                      if (newValue != null) {
                        setState(() {
                          _selectedLanguage = newValue;
                        });
                      }
                    },
                  ),
                ),
              ),
            ],
          ),
        ),

        // Chat Messages
        Expanded(
          child: ListView.builder(
            controller: _scrollController,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            itemCount: _messages.length + (_isTyping ? 1 : 0),
            itemBuilder: (context, index) {
              if (index == _messages.length && _isTyping) {
                return _buildTypingIndicator();
              }
              return _buildMessageBubble(_messages[index]);
            },
          ),
        ),

        // Quick Actions (show only when few messages)
        if (_messages.length <= 2) _buildQuickActions(),

        // Input Bar
        _buildInputBar(),
      ],
    );
  }

  Widget _buildMessageBubble(_ChatMessage message) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment:
            message.isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!message.isUser) ...[
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [_accentColor, Color(0xFF00B890)],
                ),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.auto_awesome_rounded,
                  color: Colors.white, size: 16),
            ),
            const SizedBox(width: 10),
          ],
          Flexible(
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: message.isUser
                    ? _primaryGradientStart.withAlpha(40)
                    : message.isError
                        ? const Color(0xFFFF6B6B).withAlpha(10)
                        : _cardBg.withAlpha(220),
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(18),
                  topRight: const Radius.circular(18),
                  bottomLeft: Radius.circular(message.isUser ? 18 : 4),
                  bottomRight: Radius.circular(message.isUser ? 4 : 18),
                ),
                border: Border.all(
                  color: message.isUser
                      ? _primaryGradientStart.withAlpha(30)
                      : message.isError
                          ? const Color(0xFFFF6B6B).withAlpha(30)
                          : _textSecondary.withAlpha(10),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildFormattedText(message.text),
                  const SizedBox(height: 6),
                  Text(
                    _formatTime(message.timestamp),
                    style: GoogleFonts.inter(
                      fontSize: 10,
                      color: _textSecondary.withAlpha(80),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (message.isUser) ...[
            const SizedBox(width: 10),
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [_primaryGradientStart, _primaryGradientEnd],
                ),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.person_rounded,
                  color: Colors.white, size: 16),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildFormattedText(String text) {
    // Simple markdown-like formatting
    final spans = <InlineSpan>[];
    final lines = text.split('\n');

    for (int i = 0; i < lines.length; i++) {
      if (i > 0) spans.add(const TextSpan(text: '\n'));

      String line = lines[i];

      // Handle bullet points
      if (line.startsWith('• ') || line.startsWith('- ')) {
        spans.add(TextSpan(
          text: line,
          style: GoogleFonts.inter(
            fontSize: 14,
            height: 1.6,
            color: _textPrimary,
          ),
        ));
      }
      // Handle bold text with **
      else if (line.contains('**')) {
        final parts = line.split('**');
        for (int j = 0; j < parts.length; j++) {
          spans.add(TextSpan(
            text: parts[j],
            style: GoogleFonts.inter(
              fontSize: 14,
              height: 1.6,
              fontWeight: j.isOdd ? FontWeight.w700 : FontWeight.w400,
              color: _textPrimary,
            ),
          ));
        }
      } else {
        spans.add(TextSpan(
          text: line,
          style: GoogleFonts.inter(
            fontSize: 14,
            height: 1.6,
            color: _textPrimary,
          ),
        ));
      }
    }

    return RichText(
      text: TextSpan(children: spans),
    );
  }

  Widget _buildTypingIndicator() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [_accentColor, Color(0xFF00B890)],
              ),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.auto_awesome_rounded,
                color: Colors.white, size: 16),
          ),
          const SizedBox(width: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
            decoration: BoxDecoration(
              color: _cardBg.withAlpha(220),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(18),
                topRight: Radius.circular(18),
                bottomRight: Radius.circular(18),
                bottomLeft: Radius.circular(4),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _buildDot(0),
                const SizedBox(width: 5),
                _buildDot(1),
                const SizedBox(width: 5),
                _buildDot(2),
                const SizedBox(width: 10),
                Text(
                  'Zenova AI is thinking...',
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    color: _textSecondary.withAlpha(120),
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDot(int index) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: 600 + (index * 200)),
      builder: (context, value, child) {
        return Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: _accentColor.withAlpha((100 + (155 * value)).round()),
            shape: BoxShape.circle,
          ),
        );
      },
    );
  }

  Widget _buildQuickActions() {
    return Container(
      height: 44,
      margin: const EdgeInsets.only(bottom: 8),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _quickActions.length,
        itemBuilder: (context, index) {
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: GestureDetector(
              onTap: () {
                final text = _quickActions[index]
                    .replaceAll(RegExp(r'^[^\s]+\s'), ''); // Remove emoji
                _sendMessage(text);
              },
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: _surfaceBg,
                  borderRadius: BorderRadius.circular(20),
                  border:
                      Border.all(color: _primaryGradientStart.withAlpha(25)),
                ),
                child: Center(
                  child: Text(
                    _quickActions[index],
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      color: _textPrimary,
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildInputBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 10, 10, 14),
      decoration: BoxDecoration(
        color: _cardBg,
        border: Border(
          top: BorderSide(color: _primaryGradientStart.withAlpha(15)),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(
                  color: _surfaceBg,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: _textSecondary.withAlpha(15)),
                ),
                child: TextField(
                  controller: _messageController,
                  focusNode: _focusNode,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    color: _textPrimary,
                  ),
                  decoration: InputDecoration(
                    hintText: 'Ask Zenova AI anything about health...',
                    hintStyle: GoogleFonts.inter(
                      fontSize: 14,
                      color: _textSecondary.withAlpha(80),
                    ),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  maxLines: 3,
                  minLines: 1,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (text) => _sendMessage(text),
                ),
              ),
            ),
            const SizedBox(width: 10),
            GestureDetector(
              onTap: () => _sendMessage(_messageController.text),
              child: Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [_accentColor, Color(0xFF00B890)],
                  ),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: _accentColor.withAlpha(40),
                      blurRadius: 10,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: const Icon(Icons.send_rounded,
                    color: Colors.white, size: 20),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatTime(DateTime time) {
    final hour = time.hour > 12 ? time.hour - 12 : time.hour;
    final amPm = time.hour >= 12 ? 'PM' : 'AM';
    final minute = time.minute.toString().padLeft(2, '0');
    return '$hour:$minute $amPm';
  }
}

class _ChatMessage {
  final String text;
  final bool isUser;
  final DateTime timestamp;
  final bool isError;

  _ChatMessage({
    required this.text,
    required this.isUser,
    required this.timestamp,
    this.isError = false,
  });
}
