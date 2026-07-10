# 🧠 Ritual Brain

> **AI-Driven Neural Architecture & Decentralized Compute — Built on Ritual Testnet**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-ritual--cortex--wine.vercel.app-8b5cf6?style=for-the-badge&logo=vercel)](https://ritual-cortex-wine.vercel.app/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?style=for-the-badge&logo=ethereum)](https://soliditylang.org)
[![React](https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646cff?style=for-the-badge&logo=vite)](https://vitejs.dev)

---

## 📖 Project Overview

**Ritual Brain** is a Web3 identity and reputation protocol for AI builders. It enables developers to create on-chain profiles, submit brain scan proofs to earn verified cognitive scores, mint soulbound Brain Pass NFTs, and compete on a global leaderboard — all powered by the [Ritual](https://ritual.net) decentralized AI execution network.

> Built as a Hackathon demo showcasing on-chain proof-of-intelligence, social sharing cards, and a premium glassmorphism UI.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 **On-Chain Builder Profiles** | Register your alias and credentials to the `BrainRegistryV2` smart contract |
| 🧪 **Brain Scan Verification** | Neural cognitive mapping with deterministic score generation |
| 🪪 **Brain Pass NFT** | Soulbound ERC-721 token minted on first scan verification |
| 🏆 **Global Leaderboard** | Live-ranked leaderboard fetching all builders from the blockchain |
| 📊 **Dashboard** | Real-time XP, Level, Brain Score, GFLOPS, and milestone badges |
| 🤖 **AI Mentor Chat** | Contextual AI mentor for Web3 engineering guidance |
| 🚀 **Share Achievement** | Generate a premium 1200×675 social card and share to X (Twitter) |
| 🎖️ **XP Milestone Badges** | ERC-1155 badge NFTs awarded at 1K, 5K, and 10K XP milestones |
| 📱 **Fully Responsive** | Optimized for desktop, tablet, and mobile (375px → 1920px) |

---

## 🏗️ Architecture

```
User Browser
    │
    ├── React 19 SPA (Vite)
    │       ├── Wagmi v3 + Viem v2 (wallet & contract reads)
    │       ├── @tanstack/react-query (data caching)
    │       └── html-to-image (social card generation)
    │
    └── Ritual Testnet (EVM-compatible)
            ├── BrainRegistryV2.sol  ← Primary profile registry
            ├── BrainPassNFT.sol     ← Soulbound ERC-721
            └── XPBadge.sol          ← ERC-1155 milestone badges
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite 8, Vanilla CSS |
| **Web3** | Wagmi v3, Viem v2, MetaMask / Coinbase Wallet |
| **Smart Contracts** | Solidity 0.8.24, Hardhat, OpenZeppelin v5 |
| **Deployment** | Vercel (frontend), Ritual Testnet (contracts) |
| **Tooling** | Hardhat Ignition, oxlint, TypeScript |

---

## 📜 Smart Contracts

### Deployed on Ritual Testnet

| Contract | Address | Role |
|---|---|---|
| `BrainRegistryV2` | `0xaf8E61f87E7c6820Fe34a68B9B63CE5e4cCbe4f3` | Profile registry, XP, Brain Score |
| `BrainPassNFT` | `0x40a95EFFED8Cd266EfA8Aa1279bD02Dc36C31d0d` | Soulbound ERC-721 credential |
| `XPBadge` | `0x9B421B22231C49e3dbc5Cde2FEdDF6cd4C617e2b` | ERC-1155 milestone badges |
| `BrainRegistry` *(v1 — legacy)* | `0x9693952eBd35616Cc9B325e9E68CBA1f889e56bf` | Deprecated — see `contracts/legacy/` |

### Contract Structure

```
contracts/
├── BrainRegistryV2.sol   ← Production registry (active)
├── BrainPassNFT.sol      ← ERC-721 credential NFT
├── XPBadge.sol           ← ERC-1155 milestone badges
└── legacy/
    └── BrainRegistry.sol ← V1 (deprecated, kept for reference)
```

---

## 🚀 Deployment

### Prerequisites

```bash
node >= 20
npm >= 10
```

### Local Development

```bash
git clone https://github.com/iamayushpareek2025/ritual-cortex
cd ritual-cortex
npm install
npm run dev
```

### Environment Variables

Create a `.env` file:

```env
PRIVATE_KEY=0x...your_deployer_private_key
RITUAL_RPC_URL=https://ritual-testnet-rpc.calderachain.xyz/http
```

### Production Build

```bash
npm run build
npm run preview
```

### Deploy Contracts

```bash
# Deploy V2 stack (registry + NFT + badge)
npx hardhat run scripts/deploy-v2.js --network ritual

# Verify contracts
npx hardhat run scripts/verify-v2.js --network ritual
```

---

## 🌐 Live Demo

**[https://ritual-cortex-wine.vercel.app/](https://ritual-cortex-wine.vercel.app/)**

---

## 📁 Folder Structure

```
ritual-cortex/
├── contracts/              Solidity smart contracts
│   ├── BrainRegistryV2.sol
│   ├── BrainPassNFT.sol
│   ├── XPBadge.sol
│   └── legacy/BrainRegistry.sol
├── ignition/               Hardhat Ignition deployment modules
├── scripts/                Deployment & verification scripts
├── test/                   Hardhat contract tests
├── src/
│   ├── App.jsx             Main SPA application (all pages)
│   ├── index.css           Global design system & styles
│   └── web3/
│       └── WalletProvider.jsx  Wagmi config & chain definition
├── public/
│   ├── logo.svg            Optimized SVG logo
│   ├── logo.png            512×512 transparent PNG
│   ├── logo-32x32.png
│   ├── logo-64x64.png
│   ├── logo-128x128.png
│   └── logo-256x256.png
├── index.html              SPA root with SEO meta tags
└── vite.config.js
```

---

## 🎯 Future Improvements

- [ ] **IPFS Profile Storage** — Store profile metadata on Filecoin/IPFS
- [ ] **Ritual AI Oracle Integration** — Use live Ritual network for real AI inference scoring
- [ ] **Multi-chain Support** — Expand to Ethereum Mainnet and L2s
- [ ] **DAO Governance** — Let token holders vote on XP milestone thresholds
- [ ] **Mobile App** — React Native wrapper for iOS/Android
- [ ] **ZK Proof Verification** — Integrate real zero-knowledge brain scan proofs
- [ ] **ENS Integration** — Resolve wallet addresses to ENS names on leaderboard

---

## 🤝 Contributing

This project was built for the Ritual hackathon. Contributions and forks are welcome!

---

## 📄 License

MIT © Ritual Brain Team
