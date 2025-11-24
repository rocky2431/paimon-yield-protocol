# Contributing to Paimon Yield Protocol

Thank you for your interest in contributing! This guide outlines our development standards and processes.

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help maintain a welcoming environment

---

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/paimon-yield-protocol.git`
3. Set up the development environment (see [Development Guide](./development-guide.md))
4. Create a feature branch: `git checkout -b feat/your-feature`
5. Make your changes
6. Submit a pull request

---

## Branch Naming Convention

Use the following prefixes for branch names:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feat/` | New features | `feat/add-withdrawal-queue` |
| `fix/` | Bug fixes | `fix/deposit-overflow` |
| `refactor/` | Code refactoring | `refactor/vault-architecture` |
| `docs/` | Documentation | `docs/update-readme` |
| `test/` | Adding tests | `test/vault-invariants` |
| `chore/` | Maintenance | `chore/update-dependencies` |

**Task-based branches**: `feat/task-{id}-{short-description}`

---

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Code style (formatting, no logic change) |
| `refactor` | Code refactoring |
| `test` | Adding or updating tests |
| `chore` | Build process or auxiliary tools |
| `perf` | Performance improvement |

### Scopes

| Scope | Description |
|-------|-------------|
| `contracts` | Smart contracts |
| `frontend` | Frontend application |
| `backend` | Backend API |
| `ci` | CI/CD configuration |
| `deps` | Dependencies |

### Examples

```
feat(contracts): implement ERC4626 deposit function

- Add deposit() and mint() functions
- Add minimum deposit validation ($500)
- Emit Deposit event

Closes #123
```

```
fix(frontend): resolve wallet connection on mobile

The RainbowKit modal was not opening on mobile Safari.
Added explicit touch event handling.

Fixes #456
```

---

## Code Style

### Solidity

- **Version**: ^0.8.24
- **Formatter**: `forge fmt`
- **Style Guide**: [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";

/// @title PNGYVault
/// @notice Main vault contract for yield aggregation
/// @dev Implements ERC4626 tokenized vault standard
contract PNGYVault is ERC4626 {
    // State variables
    uint256 public constant MIN_DEPOSIT = 500e18;

    // Events
    event DepositProcessed(address indexed user, uint256 amount);

    // Errors
    error DepositTooSmall(uint256 amount, uint256 minimum);

    /// @notice Deposit assets into the vault
    /// @param assets Amount of assets to deposit
    /// @param receiver Address to receive shares
    function deposit(
        uint256 assets,
        address receiver
    ) public override returns (uint256) {
        if (assets < MIN_DEPOSIT) {
            revert DepositTooSmall(assets, MIN_DEPOSIT);
        }
        return super.deposit(assets, receiver);
    }
}
```

### TypeScript (Frontend/Backend)

- **ESLint**: Strict mode enabled
- **Prettier**: Default configuration
- **Style**: Functional components, hooks

```typescript
// Use explicit types
interface VaultStats {
  totalAssets: bigint;
  sharePrice: bigint;
  apy: number;
}

// Use const for arrow functions
const calculateAPY = (totalAssets: bigint, period: number): number => {
  // Implementation
};

// Export at the bottom
export { VaultStats, calculateAPY };
```

### React Components

```tsx
import { useState, useEffect } from 'react';
import type { FC } from 'react';

interface DepositFormProps {
  onDeposit: (amount: bigint) => void;
  disabled?: boolean;
}

export const DepositForm: FC<DepositFormProps> = ({
  onDeposit,
  disabled = false,
}) => {
  const [amount, setAmount] = useState('');

  const handleSubmit = () => {
    const value = BigInt(amount);
    onDeposit(value);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form content */}
    </form>
  );
};
```

---

## Testing Standards

### Test Coverage Requirements

| Area | Minimum Coverage |
|------|-----------------|
| Smart Contracts | 95% |
| Backend API | 80% |
| Frontend Components | 80% |
| Critical Paths | 100% |

### Smart Contract Tests

```solidity
// test/PNGYVault.t.sol
contract PNGYVaultTest is Test {
    // Setup
    function setUp() public {
        // Initialize test environment
    }

    // Unit tests
    function test_Deposit_Success() public {
        // Test happy path
    }

    function test_Deposit_RevertWhen_AmountTooSmall() public {
        // Test error case
    }

    // Fuzz tests
    function testFuzz_Deposit(uint256 amount) public {
        amount = bound(amount, MIN_DEPOSIT, MAX_DEPOSIT);
        // Test with random amounts
    }

    // Invariant tests
    function invariant_TotalAssetsMatchesBalance() public {
        // Assert invariants
    }
}
```

### Backend Tests

```typescript
// src/__tests__/vault.test.ts
import { describe, it, expect, beforeEach } from 'vitest';

describe('VaultService', () => {
  beforeEach(() => {
    // Setup
  });

  it('should return vault stats', async () => {
    // Test implementation
  });

  it('should throw error for invalid address', async () => {
    // Test error handling
  });
});
```

---

## Pull Request Process

### Before Submitting

- [ ] Code follows style guidelines
- [ ] Tests pass locally
- [ ] New tests added for new features
- [ ] Documentation updated
- [ ] No console.log or debug code
- [ ] No hardcoded values (use constants/env)

### PR Template

Your PR description should include:

1. **Description**: What does this PR do?
2. **Type of Change**: Feature/Bug fix/Refactor/etc.
3. **Related Issues**: Link to issues
4. **Testing**: How was this tested?
5. **Screenshots**: If applicable

### Review Process

1. Create PR from your feature branch to `main`
2. Ensure CI checks pass
3. Request review from maintainers
4. Address feedback
5. Squash and merge once approved

---

## Security Considerations

### Smart Contracts

- Always check for reentrancy vulnerabilities
- Validate all external inputs
- Use SafeMath (or Solidity 0.8+ built-in overflow checks)
- Follow checks-effects-interactions pattern
- Consider front-running implications

### Backend

- Validate all user inputs
- Use parameterized queries (Prisma handles this)
- Implement rate limiting
- Never log sensitive data

### Frontend

- Sanitize user inputs
- Use CSP headers
- Validate wallet signatures

---

## Questions?

- Open an issue for bugs or feature requests
- Join our Discord for discussions
- Review existing issues before creating new ones

---

Thank you for contributing to Paimon Yield Protocol!
