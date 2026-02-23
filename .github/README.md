# WDK Documentation

This repository contains the documentation source files for the **Wallet Development Kit (WDK)** by Tether.

## 📚 View Documentation

**For the full documentation, please visit:**

**[docs.wallet.tether.io](https://docs.wallet.tether.io)**

---

## About WDK

The Wallet Development Kit (WDK) is Tether's open-source toolkit that empowers developers to build secure, multi-chain, self-custodial wallets that can be integrated anywhere—from embedded devices to mobile, desktop, and server operating systems.

## Contributing

If you'd like to contribute or report issues, please feel free to open an issue or pull request.

## PR Preview Deployment (Vercel)

This repository uses GitHub Actions to build docs and publish a Vercel preview for each pull request:

- Workflow: `PR Preview (Vercel)`
- Check/job name: `Build + Vercel Preview`
- Workflow file: `.github/workflows/pr-preview-vercel.yml`

### Required GitHub Secrets

Configure these repository secrets in **Settings → Secrets and variables → Actions**:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

### Make It Required for Merge

To enforce this as a merge requirement on your default branch:

1. Open **Settings → Branches**.
2. Edit your protection rule (for example, `main`).
3. Enable **Require status checks to pass before merging**.
4. Add the status check **Build + Vercel Preview**.
5. Save the rule.
