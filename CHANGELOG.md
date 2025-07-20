# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- GitHub Actions release workflow for automated releases
- Enhanced temporary roles with proper data persistence
- Improved role management with better validation
- Update script for automated bot updates
- Developer command system with runtime permission checks
- `/storage` command for storage status monitoring

### Changed

- Streamlined README.md with better organization
- Consolidated deployment guides (merged VPS_DEPLOYMENT.md)
- Enhanced database manager with better error handling
- Improved scheduler with proper cleanup
- Better error messages and validation
- Updated developer commands with clear "🔒 [DEVELOPER ONLY]" descriptions
- Simplified deployment scripts to 4 essential commands
- Renamed "bot owner" references to "developer" throughout codebase

### Fixed

- Fixed list-temp-roles command (getExpiredTemporaryRoles error)
- Fixed date parsing issues in temporary role display
- Added cache clearing to prevent stale data
- Fixed data structure handling for temporary roles
- Enhanced permission checking and feedback

### Performance

- Implemented 5-minute cache timeout
- Added automatic data sync between storage methods
- Enhanced error handling and logging
- Improved command response times

## [0.1.0] - 2025-07-10

### Added

- Initial Discord role reactor bot implementation
- Self-assignable roles through reactions
- Temporary role system with auto-expiration
- Role management commands (`/setup-roles`, `/update-roles`, `/delete-roles`, `/list-roles`)
- Temporary role commands (`/assign-temp-role`, `/list-temp-roles`, `/remove-temp-role`)
- Health monitoring and performance metrics (`/health`, `/performance`)
- Structured logging system with file output
- Docker deployment support
- MongoDB integration for data persistence
- Permission controls and validation
- Custom emoji support (Unicode and server emojis)
- Role categories and organization
- Developer management commands
- Comprehensive error handling and rate limiting
