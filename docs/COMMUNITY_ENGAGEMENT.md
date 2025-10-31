# Community Engagement & Metrics

This document outlines how we track and improve community engagement in rad.io.

## Engagement Goals

### Primary Objectives

1. **Increase Active Contributors**: Grow monthly active contributors
2. **Improve Response Times**: Faster feedback on issues and PRs
3. **Enhance Onboarding**: Reduce time-to-first-contribution
4. **Build Community**: Foster collaboration and knowledge sharing
5. **Maintain Quality**: Keep high code standards while welcoming newcomers

### Success Metrics

We track these metrics quarterly:

#### Contributor Metrics

- Number of unique contributors per quarter
- First-time contributors vs. returning contributors
- Average time-to-first-contribution after onboarding
- Contributor retention rate (return after first PR)

#### Response Metrics

- Average time-to-first-response on issues
- Average time-to-first-review on PRs
- Issue resolution time
- PR merge time

#### Quality Metrics

- Test coverage (maintain global minimum of 38% for statements/lines; see [docs/ONBOARDING.md](./ONBOARDING.md#coverage-requirements))
- Code review thoroughness
- Documentation completeness
- CI/CD success rate

#### Community Health

- GitHub Discussions activity
- Question response rate
- Community meeting attendance (when implemented)
- Contributor satisfaction (survey)

## Engagement Strategies

### For New Contributors

**1. Clear Onboarding Path**

- [First-Time Contributor Checklist](../.github/FIRST_TIME_CONTRIBUTOR_CHECKLIST.md)
- [Onboarding Guide](./ONBOARDING.md)
- `good first issue` labels
- Welcoming PR comments

**2. Documentation**

- Comprehensive guides using Diátaxis framework
- Video tutorials (planned)
- Architecture documentation
- Code comments and examples

**3. Mentorship**

- Pairing experienced contributors with newcomers
- Code review as teaching opportunity
- Office hours (planned)
- Pair programming sessions (planned)

### For Active Contributors

**1. Recognition**

- Listed in [CONTRIBUTORS.md](../CONTRIBUTORS.md)
- Highlighted in release notes
- Maintainer nomination pathway
- Community shout-outs

**2. Opportunities**

- Complex issues for experienced developers
- Architecture discussions
- Feature design participation
- Code review responsibilities

**3. Growth**

- Technical deep-dive sessions
- Conference talk support
- Blog post opportunities
- Maintainer track

### For Maintainers

**1. Efficiency Tools**

- Issue templates
- PR checklists
- Automated testing
- CI/CD pipeline

**2. Communication**

- Regular roadmap updates
- Clear decision-making process
- Transparent governance
- Monthly community calls

**3. Sustainability**

- Clear maintainer responsibilities
- Succession planning
- Burnout prevention
- Shared decision-making

## Automated Tracking

### GitHub Actions Workflows

We've implemented several automation workflows to improve community engagement:

**1. Welcome Bot (`.github/workflows/welcome.yml`)**
- Greets first-time issue authors with helpful resources
- Welcomes first-time PR contributors with onboarding checklist
- Provides links to documentation and community channels

**2. Auto-labeling (`.github/workflows/label-issues.yml`)**
- Automatically categorizes issues based on content
- Labels: documentation, testing, hardware, performance, accessibility, visualization, etc.
- Identifies good first issues for newcomers
- Helps contributors find relevant issues faster

**3. Stale Management (`.github/workflows/stale.yml`)**
- Identifies inactive issues (60 days) and PRs (30 days)
- Sends gentle reminders before closing
- Respects exempt labels (pinned, security, in-progress, blocked)
- Removes stale label when updated

**4. Contributor Recognition (`.github/workflows/contributor-recognition.yml`)**
- Celebrates milestone PRs (1st, 5th, 10th, 25th, etc.)
- Thanks all contributors after merge
- Encourages continued participation
- Builds community culture

**5. Community Metrics (`.github/workflows/community-metrics.yml`)**
- Generates monthly health reports automatically
- Tracks contributors, issues, PRs, response times
- Saves reports to `.github/metrics/`
- Provides data for continuous improvement

### GitHub Insights

Use GitHub's built-in analytics:

1. **Traffic**
   - Repository > Insights > Traffic
   - Track views, clones, referrers

2. **Community**
   - Repository > Insights > Community
   - Track contributor growth

3. **Pulse**
   - Repository > Insights > Pulse
   - Weekly activity summary

4. **Network**
   - Repository > Insights > Network
   - Visualize forks and branches

### Manual Tracking

We maintain a quarterly health check:

**Template:**

```markdown
## Q[N] YYYY Community Health Report

### Contributor Stats

- Unique contributors: [N]
- First-time contributors: [N]
- Returning contributors: [N]
- Top contributors: [list]

### Activity Stats

- Issues opened/closed: [N/N]
- PRs opened/merged: [N/N]
- Discussion posts: [N]
- Comments: [N]

### Response Times

- Avg time-to-first-response (issues): [N] days
- Avg time-to-first-review (PRs): [N] days
- Avg issue resolution time: [N] days
- Avg PR merge time: [N] days

### Quality Metrics

- Test coverage: [N]%
- CI success rate: [N]%
- Code review participation: [N]%

### Highlights

- [Significant contributions]
- [Community milestones]
- [Areas of improvement]

### Action Items

- [ ] [Action 1]
- [ ] [Action 2]
```

### Community Surveys

**Annual Contributor Survey** (planned):

- Onboarding experience
- Documentation quality
- Code review feedback
- Community satisfaction
- Improvement suggestions

**Exit Interviews** (informal):

- Why contributors leave
- Barriers to contribution
- Suggestions for improvement

## Improvement Process

### Quarterly Review Cycle

1. **Collect Metrics** (Week 1)
   - Gather GitHub insights
   - Review manual tracking
   - Survey feedback (if available)

2. **Analyze Trends** (Week 2)
   - Compare to previous quarter
   - Identify patterns
   - Spot problems early

3. **Plan Improvements** (Week 3)
   - Set specific goals
   - Create action items
   - Assign responsibilities

4. **Implement Changes** (Ongoing)
   - Execute action items
   - Monitor progress
   - Adjust as needed

### Responding to Trends

**If contributor numbers drop:**

- Review onboarding process
- Increase `good first issue` labeling
- Host community events
- Reach out to inactive contributors

**If response times increase:**

- Add more reviewers
- Simplify review process
- Use automated tools
- Set clearer expectations

**If quality decreases:**

- Enhance testing requirements
- Improve documentation
- More thorough code reviews
- Additional CI checks

## Community Events

We host regular community events to foster collaboration and learning. Full details available in [Community Meetings Guide](../.github/COMMUNITY_MEETINGS.md).

### Monthly Community Calls

**Schedule:** First Tuesday of each month at 6:00 PM UTC

**Format:**
- 60-minute video calls
- Open to all community members
- Meeting links posted in GitHub Discussions
- Recordings and notes shared afterward

**Typical Agenda:**
1. Welcome & introductions (5 min)
2. Project updates (10 min)
3. Featured topic/demo (20 min)
4. Open discussion (20 min)
5. Next steps & action items (5 min)

**Topics Include:**
- Technical deep-dives
- Feature planning and demos
- Contributor showcases
- Q&A sessions
- Architecture discussions

### Virtual Office Hours (Q1 2026)

**Planned Format:**
- Weekly or bi-weekly sessions
- 1-hour drop-in style
- Video call platform
- Informal and welcoming

**Purpose:**
- Real-time Q&A
- Pair programming support
- Code review assistance
- Onboarding help

### Contribution Sprints (Quarterly)

**Format:**
- Weekend-long focused events
- Specific theme or goal
- Coordinated via Discussions
- Optional video hangouts

**Possible Themes:**
- Documentation sprint
- Bug bash
- Testing marathon
- Accessibility audit
- Performance optimization
- Device support expansion

## Communication Channels

### Primary Channels

1. **GitHub Discussions**
   - Q&A
   - Feature discussions
   - Announcements
   - Show and tell

2. **GitHub Issues**
   - Bug reports
   - Feature requests
   - Task tracking

3. **Pull Requests**
   - Code contributions
   - Code review
   - Technical discussions

### Future Channels (Planned)

1. **Discord/Slack**
   - Real-time chat
   - Community building
   - Quick questions
   - Social interaction

2. **Blog**
   - Technical articles
   - Release announcements
   - Contributor spotlights
   - Tutorials

3. **Newsletter**
   - Monthly updates
   - Community highlights
   - Roadmap progress
   - Call for contributions

## Recognition Programs

### Contributor Levels

**New Contributor**

- First merged PR
- Added to CONTRIBUTORS.md
- Welcome message
- Badge in PR

**Regular Contributor**

- 5+ merged PRs
- Recognized in release notes
- Invited to planning discussions
- Code review privileges

**Core Contributor**

- 20+ merged PRs
- Significant feature contributions
- Mentoring new contributors
- Considered for maintainer role

**Maintainer**

- Consistent high-quality contributions
- Community leadership
- Active code review
- Project governance participation

### Monthly Highlights

In Discussions, we highlight:

- 🏆 Contributor of the month
- 🎉 First-time contributors
- 💡 Best feature contribution
- 🐛 Most impactful bug fix
- 📝 Documentation hero
- 💬 Community helper

## Feedback Mechanisms

### Gathering Feedback

**Continuous:**

- PR comments
- Issue discussions
- Discussion posts
- Code review feedback

**Periodic:**

- Quarterly surveys
- Annual contributor survey
- Community call discussions
- One-on-one conversations

**Exit Feedback:**

- When contributors leave
- When PRs are abandoned
- When issues go stale

### Acting on Feedback

1. **Acknowledge** - Thank contributors for feedback
2. **Evaluate** - Assess feasibility and impact
3. **Plan** - Create action items if actionable
4. **Implement** - Make changes
5. **Communicate** - Share what changed and why

## Resources

### For Community Managers

- [Community Guidelines](../COMMUNITY.md)
- [Governance](../GOVERNANCE.md)
- [Code of Conduct](../CODE_OF_CONDUCT.md)
- [Support](../SUPPORT.md)

### For Contributors

- [Contributing Guide](../CONTRIBUTING.md)
- [First-Time Checklist](../.github/FIRST_TIME_CONTRIBUTOR_CHECKLIST.md)
- [Onboarding Guide](./ONBOARDING.md)
- [Architecture](../ARCHITECTURE.md)

### External Resources

- [GitHub Community Health Files](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions)
- [Open Source Guides](https://opensource.guide/)
- [Contributor Covenant](https://www.contributor-covenant.org/)

## Continuous Improvement

This document is living. Suggest improvements via:

- Pull requests
- GitHub Discussions
- Issues
- Community calls

**Last reviewed:** 2025-10-30

**Next review:** Q1 2026
