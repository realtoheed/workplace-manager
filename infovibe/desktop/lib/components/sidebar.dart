import 'package:flutter/material.dart';
import '../models/user.dart';

class Sidebar extends StatelessWidget {
  final int currentIndex;
  final List<String> titles;
  final List<IconData> icons;
  final User user;
  final Function(int) onItemSelected;
  final VoidCallback onLogout;

  const Sidebar({
    super.key,
    required this.currentIndex,
    required this.titles,
    required this.icons,
    required this.user,
    required this.onItemSelected,
    required this.onLogout,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      width: 260,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        border: Border(right: BorderSide(color: Theme.of(context).dividerTheme.color!)),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            child: Row(
              children: [
                Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(
                    color: Theme.of(context).primaryColor,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Center(child: Text('WM', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold))),
                ),
                const SizedBox(width: 12),
                Text('Workplace', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: isDark ? Colors.white : const Color(0xFF0F172A))),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: titles.length,
              itemBuilder: (_, i) => _navItem(context, i),
            ),
          ),
          const Divider(height: 1),
          Container(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 16,
                  backgroundColor: Theme.of(context).primaryColor,
                  child: Text(user.name.isNotEmpty ? user.name[0].toUpperCase() : '?', style: const TextStyle(color: Colors.white, fontSize: 14)),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(user.name, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: isDark ? Colors.white : const Color(0xFF0F172A))),
                      Text(user.role.replaceAll('_', ' '), style: const TextStyle(fontSize: 11, color: Colors.grey)),
                    ],
                  ),
                ),
                InkWell(onTap: onLogout, child: Icon(Icons.logout, size: 18, color: Colors.grey[500])),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _navItem(BuildContext context, int index) {
    final selected = currentIndex == index;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
      child: Material(
        color: selected
          ? Theme.of(context).primaryColor.withOpacity(0.1)
          : Colors.transparent,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: () => onItemSelected(index),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                Icon(icons[index], size: 20, color: selected ? Theme.of(context).primaryColor : (isDark ? Colors.grey[400] : Colors.grey[600])),
                const SizedBox(width: 12),
                Text(titles[index], style: TextStyle(
                  fontSize: 14,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                  color: selected ? Theme.of(context).primaryColor : (isDark ? Colors.grey[300] : Colors.grey[700]),
                )),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
