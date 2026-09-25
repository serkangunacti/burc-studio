import { createInterface } from 'node:readline/promises';
import { hashPassword } from '../src/lib/auth/password';

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const password = await rl.question('Giriş şifresi (en az 12 karakter): ');
  rl.close();
  console.log(await hashPassword(password));
}

void main();
