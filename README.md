# SUI GENESIS • DIGITAL_PRESTIGE_PROTOCOL v1.0.4

<div align="center">
  <p align="center">
    A minimalist, high-contrast, fully responsive NFT Launchpad and ecosystem protocol built natively on the Sui Network.
  </p>
</div>

---

## 01 • OVERVIEW
**Sui Genesis** is an enterprise-grade NFT Launchpad and Utility platform. Designed with a **terminal-inspired aesthetic**, the platform prioritizes data density, photographic contrast, and cryptographic transparency. It offers a secure, high-performance environment for asset distribution, vaulting, and secondary trade. The entire application is fully responsive, ensuring a seamless experience across desktop, tablet, and mobile devices while adhering to modern Web3 best practices.

## 02 • CORE_MODULES

### ◈ ASSET_DISTRIBUTION (MINT)
The protocol supports multiple distribution cycles with granular control using Sui Programmable Transaction Blocks (PTBs):
- **Phase Control**: Transition seamlessly between `Upcoming`, `Allowlist`, and `Public` cycles.
- **Verification Engine**: Uses off-chain Merkle tree proofs (`merkletreejs` & `keccak256`) to verify eligible identifiers for restricted contribution phases, optimizing on-chain gas costs.
- **Strategy Selector**:
  - **Standard**: Direct-to-kiosk distribution.
  - **Incentivized Auction**: Dutch-auction mechanics for fair price discovery.
  - **Committed Allocation**: Secure allocation for early protocol contributors (Commit-Reveal flows).

### ◈ ASSET_VAULT (COLLECTION & FORGE)
A professional ledger for on-chain identity management and NFT upgrading:
- **Kiosk-Native**: Full integration with `Sui Kiosk` for native asset security. Hooks dynamically resolve `KioskOwnerCap` and bundle creation PTBs if the user is missing a Kiosk.
- **Yield Staking**: Protocol-level native staking dashboard that dynamically queries `StakingExtension`. Bundles the installation and staking PTBs seamlessly.
- **Upgrade Forge**: Advanced functionality to synthesize and burn multiple assets into a single refined artifact using a 4-kiosk argument PTB.

### ◈ MARKET_HYPERGRID
- **P2P Rentals**: Enables delegation of asset utility rights without transferring ownership using the `RentCap` logic to handle lending/borrowing transaction payloads.
- **Secondary Trade**: High-performance marketplace with enforced royalty rules. Uses `transfer_policy::confirm_request` within the purchase PTB to ensure on-chain royalty distribution.
- **Institutional Analytics**: Real-time stats engine tracking floor prices, volume, and holder distribution.

### ◈ LIVE EVENT INDEXING & AI_ADVISOR
An integrated **Terminal Log** interface that provides protocol insights using:
- **WebSockets**: Implemented `LiveActivityFeed` using `suiClient.subscribeEvent` to power a real-time live activity feed of the network directly on the homepage.
- **AI Integration**: AI-powered price estimations and trait suggestions.

## 03 • DESIGN_PHILOSOPHY: DIGITAL PRESTIGE
The application utilizes a proprietary **Terminal-Inspired UI** characterized by:
- **Responsive Excellence**: Impeccable layout scaling from ultra-wide monitors down to standard mobile screens.
- **Photographic Contrast**: A strict sharp Black/White palette to emphasize digital asset clarity and reduce visual clutter.
- **Grid-Aligned Layouts**: Max-width `1600px` containers with sharp `border-white/10` divisions.
- **Monospace Typography**: Technical labels with wide tracking (`0.4em`) to simulate command-line interfaces.
- **Micro-Animations**: Subtle, spring-based transitions powered by `Framer Motion` for an elite interaction feel.

## 04 • TECH_STACK
- **Core**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/) + TypeScript
- **Blockchain**: [@mysten/dapp-kit](https://sdk.mystenlabs.com/dapp-kit) + `@mysten/sui` (PTBs)
- **Cryptography**: `merkletreejs`, `keccak256`
- **Styling**: Vanilla Tailwind CSS + PostCSS
- **Motion**: [Framer Motion](https://www.framer.com/motion/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Data Fetching**: React Query (via `@mysten/dapp-kit`)

## 05 • RUN_AND_DEPLOY

### Prerequisites
- Node.js (v18+)
- npm / yarn / pnpm

### Initialization
```bash
# 1. Clone repository and install dependencies
npm install

# 2. Configure environment variables (.env)
# Required variables:
# VITE_PACKAGE_ID
# VITE_MINT_CONFIG_ID
# VITE_TRANSFER_POLICY_ID
# VITE_STATE_ID (if applicable)

# 3. Initialize local node
npm run dev
```

### Protocol Deployment
The protocol utilizes standard Move-based smart contracts. Ensure all package and object IDs are correctly configured in `src/lib/sui.ts` and `.env` for your desired network (Mainnet / Testnet). Vercel deployment requires ensuring `vercel.json` is present to handle SPA routing (`"rewrites": [{"source": "/(.*)", "destination": "/"}]`).

---

<div align="center">
  <p align="center">
    ESTABLISHED_2026 • NETWORK_SYNC: ACTIVE • SUI_MAINNET
  </p>
</div>
