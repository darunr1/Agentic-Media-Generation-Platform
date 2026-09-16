# Local production demo

1. Follow README setup, including migrations, seed and all three app processes. Keep providers set to mock; no paid API key is needed.
2. Use the development demo sign-in and select Riverbend Coffee. Review or edit its brand voice, avoidance rules and knowledge sources.
3. Create a campaign with target platform MOCK. Generate strategy, wait for the persisted workflow to succeed, and return to the campaign.
4. Generate ideas and open that campaign's idea board. Accept an eligible short-video idea.
5. In the studio choose Generate script and video. Follow scriptwriter and critic, generated scene assets, reference-tone audio, captions and rendering in the timeline. Reload to demonstrate persistence.
6. Open the studio when complete. Play the real MP4 and download the captions. Mock audio is a reference tone, not spoken narration.
7. Edit script/scene/platform text if desired, then review and render the saved script. Prior approval is invalidated; the critic runs again. Inspect snapshots and add comments.
8. Open Approvals, view the content, acknowledge compliance and approve. Request changes or reject to block scheduling instead.
9. Return to the approved content, select the explicit mock account, and publish now or schedule a future local time. Keep the worker running until due.
10. Open Analytics with platform MOCK. Inspect recorded metrics, evidence for observations and CSV. Numbers are deterministic mock fixtures, not real audience results.

The Playwright production test creates a fresh campaign and follows this route in a disposable database, with separate worker and renderer processes.
