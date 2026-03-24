# SUI GENESIS • DIGITAL_PRESTIGE_PROTOCOL v1.0.4

<div align="center">
  <p align="center">
    A minimalist, high-contrast NFT Launchpad and ecosystem protocol built natively on the Sui Network.
  </p>
</div>

---

## 01 • OVERVIEW
**Sui Genesis** is more than a launchpad; it is a comprehensive identity and asset protocol for the next generation of digital artifacts. Designed with a **terminal-inspired aesthetic**, the platform prioritizes data density, photographic contrast, and cryptographic transparency. It offers a secure, high-performance environment for asset distribution, vaulting, and secondary trade.

## 02 • CORE_MODULES

### ◈ ASSET_DISTRIBUTION (MINT)
The protocol supports multiple distribution cycles with granular control:
- **Phase Control**: Transition seamlessly between `Upcoming`, `Allowlist`, and `Public` cycles.
- **Verification Engine**: Uses cryptographic Merkle trees to verify eligible identifiers for restricted contribution phases.
- **Strategy Selector**:
  - **Standard**: Direct-to-kiosk distribution.
  - **Incentivized Auction**: Dutch-auction mechanics for fair price discovery.
  - **Committed Allocation**: Secure allocation for early protocol contributors.

### ◈ ASSET_VAULT (COLLECTION)
A professional ledger for on-chain identity management:
- **Kiosk-Native**: Full integration with Sui Kiosk for asset security.
- **Yield Staking**: Protocol-level staking to accrue SUI rewards based on asset rarity and multiplier weights.
- **Identity Merging**: Advanced functionality to synthesize multiple assets into a single refined artifact.

### ◈ MARKET_HYPERGRID
- **Rental Protocol**: Enables delegation of asset utility rights without transferring ownership.
- **Secondary Trade**: High-performance marketplace with enforced loyalty rules.
- **Institutional Analytics**: Real-time stats engine tracking floor prices, volume, and holder distribution.

### ◈ AI_ADVISOR
An integrated **Terminal Log** interface that provides protocol insights, distribution success probabilities, and real-time market signals.

## 03 • DESIGN_PHILOSOPHY: DIGITAL PRESTIGE
The application utilizes a proprietary **Terminal-Inspired UI** characterized by:
- **Photographic Contrast**: A strict Black/White/Transparent palette to emphasize digital asset clarity.
- **Grid-Aligned Layouts**: Max-width `1600px` containers with sharp `border-white/10` divisions.
- **Monospace Typography**: Technical labels with wide tracking (`0.4em`) to simulate command-line interfaces.
- **Micro-Animations**: Subtle, spring-based transitions powered by `Framer Motion` for an elite interaction feel.

## 04 • TECH_STACK
- **Core**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/)
- **Blockchain**: [@mysten/dapp-kit](https://sdk.mystenlabs.com/dapp-kit) + Sui SDK
- **Styling**: [Tailwind CSS 4.0](https://tailwindcss.com/) (using advanced grid and opacity shorthands)
- **Motion**: [Framer Motion](https://www.framer.com/motion/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Toast**: [React Hot Toast](https://react-hot-toast.com/)

## 05 • RUN_AND_DEPLOY

### Prerequisites
- Node.js (v18+)
- npm / yarn / pnpm

### Initialization
```bash
# 1. Clone repository and install dependencies
npm install

# 2. Configure environment
# Ensure .env.local contains your RPC endpoints and GEMINI_API_KEY
cp .env.example .env.local

# 3. Initialize local node
npm run dev
```

### Protocol Deployment
The protocol utilizes standard Move-based smart contracts. Ensure `PACKAGE_ID` and `MINT_CONFIG_ID` are correctly configured in `src/lib/sui.ts` for your desired network (Mainnet / Testnet).

---

<div align="center">
  <p align="center">
    ESTABLISHED_2026 • NETWORK_SYNC: ACTIVE • SUI_MAINNET
  </p>
</div>
