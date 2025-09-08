#!/usr/bin/env node

import { exec } from 'child_process';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

interface StatusInfo {
  managerRunning: boolean;
  containerInfo?: string;
  recentActivity: string[];
  activeTasks: string[];
  troubleshooting: string[];
}

function checkManagerStatus(): Promise<boolean> {
  return new Promise((resolve) => {
    exec('docker ps --format "{{.Names}}" | grep -x claudo-manager', (error, stdout) => {
      resolve(stdout.trim() === 'claudo-manager');
    });
  });
}

function getRecentActivity(): string[] {
  const workLogDir = join(process.cwd(), 'work-log');
  
  if (!existsSync(workLogDir)) {
    return ['No work logs found'];
  }

  try {
    const files = readdirSync(workLogDir)
      .filter(f => f.endsWith('.md') && f !== 'README.md')
      .sort()
      .slice(-3);

    return files.length > 0 
      ? files.map(f => `• ${f.replace('.md', '').replace(/^\d{4}-\d{2}-\d{2}-\d{4}-/, '')}`)
      : ['No recent activity'];
  } catch {
    return ['Error reading work logs'];
  }
}

function getActiveTasks(): string[] {
  const indexPath = join(process.cwd(), 'planning', 'INDEX.md');
  
  if (!existsSync(indexPath)) {
    return ['No planning system found'];
  }

  try {
    const content = readFileSync(indexPath, 'utf8');
    const lines = content.split('\n');
    const activeTasks: string[] = [];
    
    let inActiveSection = false;
    for (const line of lines) {
      if (line.includes('## Active Tasks')) {
        inActiveSection = true;
        continue;
      }
      if (inActiveSection && line.startsWith('## ')) {
        break;
      }
      if (inActiveSection && line.trim().startsWith('- [ ]')) {
        activeTasks.push(line.trim().replace(/^- \[ \] /, '• '));
      }
    }
    
    return activeTasks.length > 0 ? activeTasks : ['No active tasks'];
  } catch {
    return ['Error reading planning index'];
  }
}

export async function showStatus(): Promise<void> {
  console.log('🤖 Full Claudo Status\n');
  
  // Check manager status
  const managerRunning = await checkManagerStatus();
  const statusIcon = managerRunning ? '✅' : '❌';
  const statusText = managerRunning ? 'Running' : 'Stopped';
  
  console.log(`${statusIcon} Manager: ${statusText}`);
  
  if (!managerRunning) {
    console.log('   ↳ Run `claudo up` to start the manager');
  }
  
  // Recent activity
  console.log('\n📋 Recent Activity:');
  const recentActivity = getRecentActivity();
  recentActivity.forEach(activity => console.log(`   ${activity}`));
  
  // Active tasks
  console.log('\n⏳ Active Tasks:');
  const activeTasks = getActiveTasks();
  activeTasks.forEach(task => console.log(`   ${task}`));
  
  // Troubleshooting
  if (!managerRunning) {
    console.log('\n🔧 Troubleshooting:');
    console.log('   • Check Docker is running: docker --version');
    console.log('   • Start manager: claudo up');
    console.log('   • View logs: claudo logs');
  } else {
    console.log('\n📊 System Status: All systems operational');
    console.log('   • View real-time logs: claudo logs -f');
    console.log('   • Add tasks: echo "task description" > planning/inbox/task.md');
  }
  
  console.log('');
}

// Run if called directly
if (require.main === module) {
  showStatus().catch(console.error);
}