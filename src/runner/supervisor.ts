import { spawn } from 'node:child_process';
import type { VerificationResult } from '../lib/types';

export interface SupervisorConfig {
  maxDurationSeconds?: number;
  environmentAllowlist?: string[];
}

export class ProcessSupervisor {
  private maxDurationMs: number;

  constructor(config: SupervisorConfig = {}) {
    this.maxDurationMs = (config.maxDurationSeconds || 900) * 1000; // Default 15 mins
  }

  /**
   * Sanitizes environment variables to prevent accidental credential leakage
   * into child agent processes.
   */
  sanitizeEnvironment(customEnv: Record<string, string> = {}): NodeJS.ProcessEnv {
    const cleanEnv: NodeJS.ProcessEnv = { ...process.env };

    // Strip sensitive ambient cloud/git credentials
    const sensitiveKeys = [
      'AWS_SECRET_ACCESS_KEY',
      'AWS_SESSION_TOKEN',
      'GOOGLE_APPLICATION_CREDENTIALS',
      'GCLOUD_PROJECT',
      'GITHUB_TOKEN',
      'GH_TOKEN',
      'GITHUB_PAT',
      'VERCEL_TOKEN',
      'VERCEL_OIDC_TOKEN',
      'FIREBASE_TOKEN',
      'FIREBASE_PRIVATE_KEY',
      'FIREBASE_CLIENT_EMAIL',
      'GEMINI_API_KEY',
      'VCS_WEBHOOK_SECRET'
    ];

    for (const key of sensitiveKeys) {
      delete cleanEnv[key];
    }

    // Merge explicitly provided runner credentials
    return {
      ...cleanEnv,
      ...customEnv
    };
  }

  /**
   * Executes a command within the worktree with strict timeout and output capturing.
   */
  async executeCommand(
    command: string,
    args: string[],
    cwd: string,
    extraEnv: Record<string, string> = {}
  ): Promise<{ exitCode: number; stdout: string; stderr: string; durationMs: number }> {
    const startTime = Date.now();
    const env = this.sanitizeEnvironment(extraEnv);

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const child = spawn(command, args, {
        cwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString();
        if (stdout.length > 50000) stdout = stdout.slice(-50000); // Keep last 50KB
      });

      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
        if (stderr.length > 50000) stderr = stderr.slice(-50000);
      });

      const timeoutTimer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        setTimeout(() => {
          if (!child.killed) child.kill('SIGKILL');
        }, 5000);
      }, this.maxDurationMs);

      child.on('close', (code) => {
        clearTimeout(timeoutTimer);
        const durationMs = Date.now() - startTime;
        resolve({
          exitCode: timedOut ? 124 : (code ?? 1),
          stdout: stdout.trim(),
          stderr: timedOut ? `${stderr}\nExecution timed out after ${this.maxDurationMs / 1000}s` : stderr.trim(),
          durationMs
        });
      });

      child.on('error', (err) => {
        clearTimeout(timeoutTimer);
        const durationMs = Date.now() - startTime;
        resolve({
          exitCode: 1,
          stdout: '',
          stderr: `Process spawn error: ${err.message}`,
          durationMs
        });
      });
    });
  }

  /**
   * Executes a verification command synchronously or asynchronously, returning
   * an objective VerificationResult containing the real OS exit code.
   */
  async runVerificationCommand(commandLine: string, cwd: string): Promise<VerificationResult> {
    const startTime = Date.now();
    const env = this.sanitizeEnvironment();

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const child = spawn(commandLine, {
        cwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });

      child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString();
        if (stdout.length > 50000) stdout = stdout.slice(-50000);
      });

      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
        if (stderr.length > 50000) stderr = stderr.slice(-50000);
      });

      const timeoutTimer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        setTimeout(() => {
          if (!child.killed) child.kill('SIGKILL');
        }, 5000);
      }, this.maxDurationMs);

      child.on('close', (code) => {
        clearTimeout(timeoutTimer);
        const durationMs = Date.now() - startTime;
        const output = (stdout + '\n' + (timedOut ? `${stderr}\nExecution timed out after ${this.maxDurationMs / 1000}s` : stderr)).trim();
        resolve({
          command: commandLine,
          exitCode: timedOut ? 124 : (code ?? 1),
          durationMs,
          outputSnippet: output.slice(0, 2000)
        });
      });

      child.on('error', (err) => {
        clearTimeout(timeoutTimer);
        const durationMs = Date.now() - startTime;
        resolve({
          command: commandLine,
          exitCode: 1,
          durationMs,
          outputSnippet: `Process spawn error: ${err.message}`
        });
      });
    });
  }
}

