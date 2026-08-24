# Security

Security reports should be sent privately to [Support Email]. Do not include
sensitive files unless requested through an approved secure channel.

The application validates supported imports by extension, signature, and size;
uses Electron context isolation and renderer sandboxing; denies runtime
permissions, unexpected navigation, and arbitrary external URLs; validates IPC
payloads; and restricts project/export writes to user-approved dialog locations.

These controls reduce risk but do not make the application immune to every
vulnerability. Keep Electron and dependencies current and review `npm audit`
results before each release.
