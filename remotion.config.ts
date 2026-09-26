import path from 'node:path';
import { Config } from '@remotion/cli/config';

// Studio'nun webpack paketleyicisi tsconfig "paths" ayarını okumaz; uygulamadaki @/ takma adı burada tanımlanır.
Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: { ...(config.resolve?.alias as Record<string, string> | undefined), '@': path.join(process.cwd(), 'src') },
  },
}));
