import * as fs from 'fs';
import * as path from 'path';

export class CxPluginDetails {

     static getPluginVersion(): string | undefined {
        try {
            const packageJson = fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8');
            const packageData = JSON.parse(packageJson);
          return packageData.version;
        } catch (error) {
          console.error('Error reading package.json:', error);
          return undefined;
        }
      }
}