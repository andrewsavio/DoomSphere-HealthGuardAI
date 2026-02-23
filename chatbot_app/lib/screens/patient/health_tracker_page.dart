import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:fl_chart/fl_chart.dart';

import 'package:flutter/foundation.dart';
import 'package:pedometer/pedometer.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';

class HealthTrackerPage extends StatefulWidget {
  const HealthTrackerPage({super.key});

  @override
  State<HealthTrackerPage> createState() => _HealthTrackerPageState();
}

class _HealthTrackerPageState extends State<HealthTrackerPage> {
  static const _primaryGradientStart = Color(0xFF6C63FF);
  static const _primaryGradientEnd = Color(0xFF3F8CFF);
  static const _accentColor = Color(0xFF00D9A6);
  static const _darkBg = Color(0xFF0F0F23);
  static const _cardBg = Color(0xFF1A1A3E);
  static const _surfaceBg = Color(0xFF252550);
  static const _textPrimary = Color(0xFFFFFFFF);
  static const _textSecondary = Color(0xFFB0B0D0);

  // Health Data
  int _todaySteps = 0;
  double _todayDistance = 0.0;
  int _heartRate = 0;
  int _caloriesBurned = 0;
  final double _stepGoal = 10000;

  // Pedometer State
  Stream<StepCount>? _stepCountStream;
  Stream<PedestrianStatus>? _pedestrianStatusStream;
  String _status = '?';
  bool _isPedometerActive = false;
  
  // Daily Reset Logic
  int _stepsAtMidnight = 0; // Steps at start of day
  int _lastSavedDay = -1;

  // Weekly data (Initialized to 0)
  final List<double> _weeklySteps = List.filled(7, 0.0);
  final List<double> _dailyDistance = List.filled(7, 0.0); 
  final List<String> _dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  final List<_Activity> _activities = [];

  @override
  void initState() {
    super.initState();
    _initPlatformState();
  }

  Future<void> _initPlatformState() async {
    if (kIsWeb) return; 

    // Initialize SharedPreferences for daily tracking
    await _loadDailyStepsData();

    if (await Permission.activityRecognition.request().isGranted) {
      _initPedometer();
    } else {
      debugPrint('Activity recognition permission denied');
    }
  }

  Future<void> _loadDailyStepsData() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _stepsAtMidnight = prefs.getInt('steps_at_midnight') ?? 0;
      _lastSavedDay = prefs.getInt('last_saved_day') ?? -1;
    });
  }

  void _initPedometer() {
    try {
      _pedestrianStatusStream = Pedometer.pedestrianStatusStream;
      _pedestrianStatusStream!.listen(
        _onPedestrianStatusChanged,
        onError: _onPedestrianStatusError,
      );

      _stepCountStream = Pedometer.stepCountStream;
      _stepCountStream!.listen(
        _onStepCount,
        onError: _onStepCountError,
      );

      if (mounted) setState(() => _isPedometerActive = true);
    } catch (e) {
      debugPrint('Pedometer initialization check failed: $e');
    }
  }

  void _onStepCount(StepCount event) {
    if (mounted) {
      setState(() {
        final totalSteps = event.steps;
        final now = DateTime.now();
        
        if (_lastSavedDay != now.day) {

            _stepsAtMidnight = totalSteps;
            _lastSavedDay = now.day;
            _saveDailyStepsData();
        } else if (totalSteps < _stepsAtMidnight) {

            _stepsAtMidnight = 0; 
            _saveDailyStepsData();
        }

        int stepsToday = totalSteps - _stepsAtMidnight;
        if (stepsToday < 0) stepsToday = 0; 

        if (totalSteps > 0) {
            _todaySteps = stepsToday;
            
            _todayDistance = (_todaySteps * 0.762) / 1000;
            _caloriesBurned = (_todaySteps * 0.04).toInt();

            _weeklySteps[6] = _todaySteps.toDouble();
            _dailyDistance[6] = _todayDistance;
        }
      });
    }
  }

  Future<void> _saveDailyStepsData() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('steps_at_midnight', _stepsAtMidnight);
    await prefs.setInt('last_saved_day', _lastSavedDay);
  }

  void _onPedestrianStatusChanged(PedestrianStatus event) {
    if (mounted) {
      setState(() {
        _status = event.status;
      });
    }
  }

  void _onPedestrianStatusError(error) {
    debugPrint('onPedestrianStatusError: $error');
    if (mounted) setState(() => _status = 'Error');
  }

  void _onStepCountError(error) {
    debugPrint('onStepCountError: $error');
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Today's Overview Card
          _buildTodayOverview(),
          const SizedBox(height: 24),

          // Vital Stats Grid
          Row(
            children: [
              Expanded(child: _buildVitalCard(
                label: 'Heart Rate',
                value: _heartRate > 0 ? '$_heartRate' : '--',
                unit: 'bpm',
                icon: Icons.favorite_rounded,
                color: const Color(0xFFFF6B6B),
                onTap: _showHeartRateInput,
              )),
              const SizedBox(width: 12),
              Expanded(child: _buildVitalCard(
                label: 'Calories',
                value: '$_caloriesBurned',
                unit: 'kcal',
                icon: Icons.local_fire_department_rounded,
                color: const Color(0xFFFF9F43),
              )),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _buildVitalCard(
                label: 'Distance',
                value: _todayDistance.toStringAsFixed(2),
                unit: 'km',
                icon: Icons.place_rounded,
                color: _primaryGradientEnd,
              )),
              const SizedBox(width: 12),
              Expanded(child: _buildVitalCard(
                label: 'Active Min',
                value: '0', // Placeholder as we don't track time yet
                unit: 'min',
                icon: Icons.timer_rounded,
                color: _accentColor,
              )),
            ],
          ),
          const SizedBox(height: 28),

          // Weekly Steps Chart
          Text(
            'Weekly Steps',
            style: GoogleFonts.outfit(
              fontSize: 20,
              fontWeight: FontWeight.w600,
              color: _textPrimary,
            ),
          ),
          const SizedBox(height: 16),
          _buildWeeklyStepsChart(),
          const SizedBox(height: 28),

          // Daily Distance Trend (Replaces Heart Rate)
          Text(
            'Daily Distance',
            style: GoogleFonts.outfit(
              fontSize: 20,
              fontWeight: FontWeight.w600,
              color: _textPrimary,
            ),
          ),
          const SizedBox(height: 16),
          _buildDistanceChart(),
          const SizedBox(height: 28),

          // Activity Log
          Text(
            'Today\'s Activity',
            style: GoogleFonts.outfit(
              fontSize: 20,
              fontWeight: FontWeight.w600,
              color: _textPrimary,
            ),
          ),
          const SizedBox(height: 16),
          if (_activities.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(20.0),
                child: Text(
                  'No activities logged yet',
                  style: GoogleFonts.inter(color: _textSecondary),
                ),
              ),
            )
          else
            ..._activities.map((a) => _buildActivityCard(a)),
            
          const SizedBox(height: 24),

          // Add Steps Button
          GestureDetector(
            onTap: _showAddStepsDialog,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [_primaryGradientStart, _primaryGradientEnd],
                ),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: _primaryGradientStart.withAlpha(40),
                    blurRadius: 15,
                    offset: const Offset(0, 5),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.add_rounded, color: Colors.white, size: 22),
                  const SizedBox(width: 8),
                  Text(
                    'Log New Activity',
                    style: GoogleFonts.inter(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _buildTodayOverview() {
    final progress = _todaySteps / _stepGoal;
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            _accentColor.withAlpha(30),
            _primaryGradientEnd.withAlpha(20),
          ],
        ),
        border: Border.all(color: _accentColor.withAlpha(40)),
      ),
      child: Row(
        children: [
          // Circular Progress
          SizedBox(
            width: 110,
            height: 110,
            child: Stack(
              children: [
                SizedBox(
                  width: 110,
                  height: 110,
                  child: CircularProgressIndicator(
                    value: progress.clamp(0.0, 1.0),
                    strokeWidth: 8,
                    backgroundColor: _surfaceBg,
                    valueColor:
                        const AlwaysStoppedAnimation<Color>(_accentColor),
                    strokeCap: StrokeCap.round,
                  ),
                ),
                Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        _isPedometerActive
                            ? (_status == 'stopped' ? 'Idle' : _status)
                            : 'Active',
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          color: _accentColor,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        _todaySteps.toString(),
                        style: GoogleFonts.outfit(
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                          color: _textPrimary,
                        ),
                      ),
                      Text(
                        'steps',
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          color: _textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 24),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Today\'s Progress',
                  style: GoogleFonts.outfit(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: _textPrimary,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  '${(progress * 100).toInt()}% of ${_stepGoal.toInt()} goal',
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    color: _accentColor,
                  ),
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _buildMiniStatPill(Icons.directions_walk_rounded,
                        '${_todayDistance.toStringAsFixed(2)} km'),
                    _buildMiniStatPill(Icons.local_fire_department_rounded,
                        '$_caloriesBurned cal'),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMiniStatPill(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: _surfaceBg.withAlpha(150),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: _textSecondary, size: 14),
          const SizedBox(width: 6),
          Text(
            text,
            style: GoogleFonts.inter(
              fontSize: 12,
              color: _textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVitalCard({
    required String label,
    required String value,
    required String unit,
    required IconData icon,
    required Color color,
    VoidCallback? onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: _cardBg.withAlpha(200),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: color.withAlpha(30)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Icon(icon, color: color, size: 24),
                if (onTap != null)
                  Icon(Icons.edit_rounded,
                      color: _textSecondary.withAlpha(60), size: 16),
              ],
            ),
            const SizedBox(height: 14),
            RichText(
              text: TextSpan(
                children: [
                  TextSpan(
                    text: value,
                    style: GoogleFonts.outfit(
                      fontSize: 26,
                      fontWeight: FontWeight.w700,
                      color: _textPrimary,
                    ),
                  ),
                  TextSpan(
                    text: ' $unit',
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      color: _textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: GoogleFonts.inter(
                fontSize: 13,
                color: _textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWeeklyStepsChart() {
    return Container(
      height: 220,
      padding: const EdgeInsets.fromLTRB(8, 20, 20, 8),
      decoration: BoxDecoration(
        color: _cardBg.withAlpha(200),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _primaryGradientStart.withAlpha(20)),
      ),
      child: BarChart(
        BarChartData(
          alignment: BarChartAlignment.spaceAround,
          maxY: 12000,
          barTouchData: BarTouchData(
            enabled: true,
            touchTooltipData: BarTouchTooltipData(
              getTooltipColor: (_) => _surfaceBg,
              tooltipRoundedRadius: 8,
              getTooltipItem: (group, groupIndex, rod, rodIndex) {
                return BarTooltipItem(
                  '${rod.toY.toInt()} steps',
                  GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: _textPrimary,
                  ),
                );
              },
            ),
          ),
          titlesData: FlTitlesData(
            topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            leftTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 40,
                getTitlesWidget: (value, meta) {
                  if (value % 4000 != 0) return const SizedBox.shrink();
                  return Text(
                    '${(value / 1000).toInt()}k',
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      color: _textSecondary.withAlpha(120),
                    ),
                  );
                },
              ),
            ),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                getTitlesWidget: (value, meta) {
                  final idx = value.toInt();
                  if (idx < 0 || idx >= _dayLabels.length) {
                    return const SizedBox.shrink();
                  }
                  return Text(
                    _dayLabels[idx],
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      color: _textSecondary,
                    ),
                  );
                },
              ),
            ),
          ),
          gridData: FlGridData(
            show: true,
            drawVerticalLine: false,
            horizontalInterval: 4000,
            getDrawingHorizontalLine: (_) => FlLine(
              color: _textSecondary.withAlpha(15),
              strokeWidth: 1,
            ),
          ),
          borderData: FlBorderData(show: false),
          barGroups: _weeklySteps.asMap().entries.map((entry) {
            final isToday = entry.key == 6; // Last day
            return BarChartGroupData(
              x: entry.key,
              barRods: [
                BarChartRodData(
                  toY: entry.value,
                  width: 20,
                  borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(6)),
                  gradient: isToday
                      ? const LinearGradient(
                          begin: Alignment.bottomCenter,
                          end: Alignment.topCenter,
                          colors: [_primaryGradientStart, _accentColor],
                        )
                      : LinearGradient(
                          begin: Alignment.bottomCenter,
                          end: Alignment.topCenter,
                          colors: [
                            _primaryGradientStart.withAlpha(60),
                            _primaryGradientEnd.withAlpha(80),
                          ],
                        ),
                ),
              ],
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildDistanceChart() {
    return Container(
      height: 200,
      padding: const EdgeInsets.fromLTRB(8, 20, 20, 8),
      decoration: BoxDecoration(
        color: _cardBg.withAlpha(200),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _primaryGradientEnd.withAlpha(20)),
      ),
      child: LineChart(
        LineChartData(
          minY: 0,
          maxY: 10, // Assuming 10km max for daily view
          lineTouchData: LineTouchData(
            touchTooltipData: LineTouchTooltipData(
              getTooltipColor: (_) => _surfaceBg,
              tooltipRoundedRadius: 8,
              getTooltipItems: (spots) {
                return spots.map((s) {
                  return LineTooltipItem(
                    '${s.y.toStringAsFixed(1)} km',
                    GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: _primaryGradientEnd,
                    ),
                  );
                }).toList();
              },
            ),
          ),
          titlesData: FlTitlesData(
            topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            leftTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 35,
                getTitlesWidget: (value, meta) {
                  return Text(
                    '${value.toInt()}',
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      color: _textSecondary.withAlpha(120),
                    ),
                  );
                },
              ),
            ),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                getTitlesWidget: (value, meta) {
                  final idx = value.toInt();
                  if (idx < 0 || idx >= _dayLabels.length) {
                    return const SizedBox.shrink();
                  }
                  return Text(
                    _dayLabels[idx],
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      color: _textSecondary,
                    ),
                  );
                },
              ),
            ),
          ),
          gridData: FlGridData(
            show: true,
            drawVerticalLine: false,
            horizontalInterval: 2,
            getDrawingHorizontalLine: (_) => FlLine(
              color: _textSecondary.withAlpha(15),
              strokeWidth: 1,
            ),
          ),
          borderData: FlBorderData(show: false),
          lineBarsData: [
            LineChartBarData(
              spots: _dailyDistance.asMap().entries.map((e) {
                return FlSpot(e.key.toDouble(), e.value);
              }).toList(),
              isCurved: true,
              curveSmoothness: 0.3,
              color: _primaryGradientEnd,
              barWidth: 3,
              isStrokeCapRound: true,
              dotData: FlDotData(
                show: true,
                getDotPainter: (spot, percent, barData, index) {
                  return FlDotCirclePainter(
                    radius: 4,
                    color: _primaryGradientEnd,
                    strokeWidth: 2,
                    strokeColor: _darkBg,
                  );
                },
              ),
              belowBarData: BarAreaData(
                show: true,
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    _primaryGradientEnd.withAlpha(40),
                    _primaryGradientEnd.withAlpha(0),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActivityCard(_Activity activity) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: _cardBg.withAlpha(200),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: activity.color.withAlpha(25)),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: activity.color.withAlpha(25),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(activity.icon, color: activity.color, size: 24),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  activity.name,
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: _textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${activity.steps} • ${activity.distance}',
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    color: _textSecondary,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: _surfaceBg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              activity.time,
              style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: _textSecondary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showHeartRateInput() {
    final controller = TextEditingController(text: _heartRate.toString());
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: _cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          'Update Heart Rate',
          style: GoogleFonts.outfit(
            fontSize: 20,
            fontWeight: FontWeight.w600,
            color: _textPrimary,
          ),
        ),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          style: GoogleFonts.outfit(
            fontSize: 32,
            fontWeight: FontWeight.w700,
            color: const Color(0xFFFF6B6B),
          ),
          textAlign: TextAlign.center,
          decoration: InputDecoration(
            suffixText: 'bpm',
            suffixStyle: GoogleFonts.inter(
              fontSize: 16,
              color: _textSecondary,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(color: _surfaceBg),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(color: _surfaceBg),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide:
                  const BorderSide(color: Color(0xFFFF6B6B)),
            ),
            filled: true,
            fillColor: _surfaceBg,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancel',
                style: GoogleFonts.inter(color: _textSecondary)),
          ),
          ElevatedButton(
            onPressed: () {
              final val = int.tryParse(controller.text);
              if (val != null && val > 40 && val < 200) {
                setState(() => _heartRate = val);
              }
              Navigator.pop(context);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFFF6B6B),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
            child: Text('Save', style: GoogleFonts.inter(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showAddStepsDialog() {
    final stepsController = TextEditingController();
    final nameController = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: _cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          'Log Activity',
          style: GoogleFonts.outfit(
            fontSize: 20,
            fontWeight: FontWeight.w600,
            color: _textPrimary,
          ),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              style: GoogleFonts.inter(fontSize: 15, color: _textPrimary),
              decoration: InputDecoration(
                labelText: 'Activity Name',
                labelStyle: GoogleFonts.inter(color: _textSecondary),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide(color: _surfaceBg),
                ),
                filled: true,
                fillColor: _surfaceBg,
              ),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: stepsController,
              keyboardType: TextInputType.number,
              style: GoogleFonts.inter(fontSize: 15, color: _textPrimary),
              decoration: InputDecoration(
                labelText: 'Steps',
                labelStyle: GoogleFonts.inter(color: _textSecondary),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide(color: _surfaceBg),
                ),
                filled: true,
                fillColor: _surfaceBg,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancel',
                style: GoogleFonts.inter(color: _textSecondary)),
          ),
          ElevatedButton(
            onPressed: () {
              final steps = int.tryParse(stepsController.text) ?? 0;
              final name = nameController.text.isNotEmpty
                  ? nameController.text
                  : 'Activity';
              if (steps > 0) {
                final distance = (steps * 0.000762); // avg stride
                final now = TimeOfDay.now();
                setState(() {
                  _todaySteps += steps;
                  _todayDistance += distance;
                  _caloriesBurned += (steps * 0.04).round();
                  _activities.add(_Activity(
                    name,
                    '${now.hourOfPeriod}:${now.minute.toString().padLeft(2, '0')} ${now.period == DayPeriod.am ? 'AM' : 'PM'}',
                    '${steps.toString().replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')} steps',
                    '${distance.toStringAsFixed(2)} km',
                    Icons.directions_walk_rounded,
                    _accentColor,
                  ));
                });
              }
              Navigator.pop(context);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: _primaryGradientStart,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
            child: Text('Add', style: GoogleFonts.inter(color: Colors.white)),
          ),
        ],
      ),
    );
  }
}

class _Activity {
  final String name;
  final String time;
  final String steps;
  final String distance;
  final IconData icon;
  final Color color;

  _Activity(this.name, this.time, this.steps, this.distance, this.icon, this.color);
}
