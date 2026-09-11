# Social integrations

The mock provider supports connection validation, accounts, capability discovery, content validation, upload, idempotent publish, delete, status, and analytics. It powers the local journey.

Instagram and YouTube have official OAuth/publishing boundaries and configuration slots. Facebook, Threads, TikTok, and X expose typed setup-required providers. The UI never shows them as connected. Production requires official developer apps, minimal scopes, redirect URIs, a privacy policy, deletion callback, review assets, and sandbox validation.

Publishing guards require approval, complete media, active connection/subscription, remaining usage/budget, compliance acknowledgment, a valid schedule, and a new idempotency key. Tokens use authenticated encryption at rest and never enter browser responses or logs.
