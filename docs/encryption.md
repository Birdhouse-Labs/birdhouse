# How Birdhouse Encrypts Your Secrets

## Overview

Birdhouse stores your API keys and MCP server configurations in an encrypted database on your local machine. Here's how it works:

## Encryption Method

We use **AES-256-GCM** (Advanced Encryption Standard with Galois/Counter Mode):

- **AES-256**: Industry-standard encryption with 256-bit keys - the same encryption used by banks, governments, and military applications
- **GCM (Galois/Counter Mode)**: Provides both encryption AND authentication, meaning:
  - Your data is encrypted (unreadable without the key)
  - Tampering is detected (any modification to the encrypted data causes decryption to fail)
  - Each encrypted value gets a unique IV (Initialization Vector) to prevent pattern analysis

## How It Works

### 1. Master Key Generation

When you first use Birdhouse, we automatically generate a 256-bit master encryption key:

- **Location**: `~/Library/Application Support/Birdhouse/master.key`
- **Format**: 64 hexadecimal characters (32 bytes)
- **Permissions**: Read/write for your user account only (Unix file mode `600`)
- **Generation**: Cryptographically secure random number generator

### 2. When You Save Secrets

When you configure API keys or MCP servers:

1. Your secrets are formatted as JSON
2. A unique 16-byte IV (Initialization Vector) is randomly generated
3. The data is encrypted using your master key and the IV
4. A 16-byte authentication tag is generated to detect tampering
5. The IV, auth tag, and encrypted data are combined into a single blob
6. The blob is stored in your local SQLite database

**Storage format**: `[IV (16 bytes)][Auth Tag (16 bytes)][Encrypted Data]`

### 3. When OpenCode Needs Your Secrets

When Birdhouse launches OpenCode:

1. The encrypted blob is loaded from the database
2. The IV and auth tag are extracted
3. The data is decrypted using your master key
4. The auth tag is verified (fails if data was tampered with)
5. Your API keys are passed as environment variables to OpenCode
6. Your MCP config is passed via the `OPENCODE_CONFIG_CONTENT` environment variable

## Security Properties

### ✅ What This Protects Against

- **Database theft**: If someone steals your `data.db` file, they cannot read your API keys without also stealing your `master.key`
- **Data tampering**: If someone modifies the encrypted data, decryption will fail (authentication tag mismatch)
- **Accidental exposure**: Your API keys never appear in plaintext in the database
- **Log/screenshot leaks**: The GET API endpoint masks API keys (only shows "configured: yes/no")

### ⚠️ Important Limitations

This encryption is **defense in depth**, not a security boundary:

- **Same machine**: The master key is stored on the same machine as the encrypted data
- **File system access**: Anyone with access to your user account can read both files
- **Process memory**: When OpenCode is running, API keys are in plaintext in environment variables (visible via process inspection tools)
- **Not protecting against**: Malware on your machine, admin/root access, physical access to unlocked machine

### Why This Approach?

**The baseline is `.env` files** - Birdhouse provides a *better* security posture than storing API keys in plaintext `.env` files, which is the common alternative.

**This encryption protects your API keys from:**
- Accidental commits to git (database is gitignored)
- Casual file browsing
- Database dumps/exports
- Backup files being exposed

**This encryption does NOT protect against:**
- Determined attackers with OS-level access
- Malware specifically targeting your API keys
- Physical access to your machine

## For Maximum Security

If you need stronger protection, consider:

1. **OS Keychain Integration** (future enhancement):
   - macOS: Keychain
   - Windows: Credential Manager
   - Linux: Secret Service API / gnome-keyring
   
2. **Hardware Security Keys**:
   - YubiKey or similar for key storage
   
3. **Remote Secret Management**:
   - HashiCorp Vault
   - AWS Secrets Manager
   - 1Password CLI

These add significant complexity and are typically overkill for local development tools.

## Comparison to Alternatives

| Method | Security Level | Convenience |
|--------|---------------|-------------|
| **Plaintext `.env` files** | ❌ None | ✅ Simple |
| **Birdhouse encryption** | ⚠️ Basic defense | ✅ Automatic |
| **OS Keychain** | ✅ Good | ⚠️ Complex setup |
| **Hardware keys** | ✅ Excellent | ❌ Hardware required |

## Technical Details

For developers and security auditors:

- **Algorithm**: AES-256-GCM (NIST approved, FIPS 140-2 compliant)
- **Key derivation**: None (master key is random bytes, not derived from password)
- **IV management**: Unique random IV per encryption operation (never reused)
- **Auth tag length**: 128 bits (16 bytes)
- **Implementation**: Node.js `crypto` module (OpenSSL-backed)
- **Key storage**: Plaintext file with restrictive permissions (Unix `600`)

## Your Data Never Leaves Your Machine

**Important**: Birdhouse is a local-first application:

- All encryption happens locally
- Master key never transmitted anywhere
- Encrypted database stays on your machine
- No cloud sync (yet)
- No telemetry of secret values

When we add cross-machine workspace sync in the future, we'll provide options for:
- Excluding secrets from sync (manual entry per machine)
- End-to-end encrypted sync (your choice of sync provider)

## Questions?

If you have security concerns or questions about our encryption:

- Review our open-source code: [link to repo]
- File a security issue: [security@birdhouse.dev]
- Read our security policy: [SECURITY.md]

---

**Last updated**: February 2026  
**Encryption version**: 1.0 (AES-256-GCM)
