# Contributing to Filigran XTM Browser Extension

Thank you for your interest in contributing to the Filigran XTM Browser Extension! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and constructive in all interactions.

## How to Contribute

### Reporting Bugs

1. **Check existing issues** first to avoid duplicates
2. **Use the bug report template** when creating a new issue
3. **Include**:
   - Browser name and version
   - Extension version
   - Steps to reproduce
   - Expected vs actual behavior
   - Error messages from browser console (F12 → Console)
   - Screenshots if applicable

### Suggesting Features

1. **Check existing issues** for similar suggestions
2. **Describe the use case** - What problem does it solve?
3. **Provide examples** of how the feature would work

### Submitting Code

#### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/xtm-browser-extension.git
   cd xtm-browser-extension
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a feature branch:
   ```bash
   git checkout -b feature/my-feature
   ```

#### Development Workflow

1. Make your changes
2. Write/update tests as needed
3. Run tests:
   ```bash
   npm test
   ```
4. Run linter:
   ```bash
   npm run lint
   ```
5. Build and test in browser:
   ```bash
   npm run build:chrome
   ```

#### Commit Guidelines

Use clear, descriptive commit messages:

```
<type>: <short description>

<optional longer description>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks

Examples:
```
feat: Add support for MITRE ATT&CK sub-technique detection

fix: Prevent partial IP address matching in asset detection

docs: Update README with testing instructions

test: Add unit tests for MAC address pattern matching
```

#### Pull Request Process

1. Update documentation if needed
2. Ensure all tests pass
3. Push to your fork:
   ```bash
   git push origin feature/my-feature
   ```
4. Create a Pull Request with:
   - Clear title describing the change
   - Description of what and why
   - Reference to related issues (e.g., "Fixes #123")
   - Screenshots for UI changes

## Development Guidelines

### Code Style

- Use TypeScript for all new code
- Follow existing code patterns and naming conventions
- Use meaningful variable and function names
- Add JSDoc comments for public functions
- Keep functions focused and small

### Testing

- Write unit tests for new utilities and patterns
- Write integration tests for API client changes
- Test in multiple browsers (Chrome, Firefox, Edge)
- Test with both OpenCTI and OpenAEV connections

### File Organization

```
src/
├── background/      # Background service worker only
├── content/         # Content script only
├── popup/           # Popup UI components
├── panel/           # Side panel components
├── options/         # Settings page components
└── shared/          # Shared code (API, types, utils)
```

- Keep component-specific code in component folders
- Put shared code in `shared/`
- Don't import from other component folders (use messaging)

### API Changes

When modifying API clients:

1. Update TypeScript interfaces in `shared/types/`
2. Update relevant tests in `tests/integration/`
3. Test against a running platform instance
4. Document any new message types

### Detection Patterns

When adding new observable patterns:

1. Add pattern to `shared/detection/patterns.ts`
2. Add unit tests in `tests/unit/patterns.test.ts`
3. Test with real-world examples
4. Consider false positives

## Getting Help

- [GitHub Issues](https://github.com/FiligranHQ/xtm-browser-extension/issues)
- [Filigran Community](https://community.filigran.io)
- [OpenCTI Documentation](https://docs.opencti.io)

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
