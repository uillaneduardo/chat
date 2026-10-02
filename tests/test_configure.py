import importlib.util
import os
from pathlib import Path
import tempfile
import shutil
import subprocess
import unittest

spec = importlib.util.spec_from_file_location('configure', Path(__file__).resolve().parents[1] / 'scripts/configure.py')
configure = importlib.util.module_from_spec(spec)
spec.loader.exec_module(configure)

class ConfigurationTest(unittest.TestCase):
    def test_private_no_overwrite_and_literal_dollar(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / '.env'
            configure.write_private(path, {'PASSWORD': 'literal$secret#value'})
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            self.assertEqual(path.read_text(), "PASSWORD='literal$secret#value'\n")
            with self.assertRaises(FileExistsError):
                configure.write_private(path, {'PASSWORD': 'replacement'})
            self.assertIn('literal$secret', path.read_text())
    def test_unsafe_values_rejected_before_creation(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / '.env'
            for value in ["a'b", 'a\\b', 'a\nb']:
                with self.assertRaises(ValueError):
                    configure.write_private(path, {'PASSWORD': value})
                self.assertFalse(path.exists())

    def test_full_setup_and_retry_preserve_keys(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'scripts').mkdir()
            shutil.copyfile(Path(configure.__file__), root / 'scripts/configure.py')
            env = dict(os.environ, SETUP_NON_INTERACTIVE='true', SETUP_URL='https://chat.example.invalid', SETUP_COMPANY='Demo', SETUP_NAME='Owner', SETUP_EMAIL='owner@example.invalid', SETUP_PASSWORD='synthetic$pass#word')
            result = subprocess.run(['python3', str(root / 'scripts/configure.py')], env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            original = (root / '.env').read_bytes()
            self.assertNotIn('synthetic', result.stdout)
            self.assertNotIn('BOOTSTRAP_PASSWORD', original.decode())
            retry = subprocess.run(['python3', str(root / 'scripts/configure.py')], env=env, capture_output=True, text=True)
            self.assertNotEqual(retry.returncode, 0)
            self.assertEqual((root / '.env').read_bytes(), original)
            self.assertIn("'synthetic$pass#word'", (root / '.env.bootstrap').read_text())

if __name__ == '__main__':
    unittest.main()
