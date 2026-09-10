# StakeVerse Protocol — MVP

🌐 **Select Language / Selecione o Idioma:**
*   [English Version (# English)](#-english)
*   [Versão em Português (# Português)](#-português)

📸 **Quick Access / Acesso Rápido:**
*   [Skip to Interface Preview ⚡](#main-dashboard--painel-principal)

---

# 🇺🇸 English

## 📌 About the Project
The **StakeVerse Protocol** is a decentralized, modular Web3 ecosystem developed as an MVP for the *Complete Web3 Protocol Development with Testnet Deployment* course (Advanced Phase — Unit 1 | Chapter 5).

The protocol addresses fragmentation and low participation in DAOs by mitigating opportunity costs through a circular and modular incentive ecosystem:
*   **Integrated Tokenomics:** Users utilize the native utility token to lock in staking contracts and generate cyclical yields.
*   **Membership NFT:** A DAO-issued ERC-721 credential (`StakeVerseNFT`) exists, but as of the current implementation it does **not** gate staking or governance participation, and issuance is uncapped/non-scarce — see "Known Documentation Gaps" below.
*   **Active Governance:** Voting power comes from `StakeVerseToken`'s ERC20Votes delegation, snapshotted per proposal. It is independent of staking — staking a token carries no special voting weight, and an un-staked, delegated token votes exactly the same way.

The protocol went through a structured, multi-phase security remediation and verification process (staking accounting, governance/voting power, proposal quorum/threshold, Chainlink oracle validation, an emergency pause mechanism, ownership finalization to the DAO, and monetary/issuance policy review), evidenced by a 146-test automated regression suite. See [`audit/SECURITY_AUDIT.md`](audit/SECURITY_AUDIT.md) for the full findings record. The hardened contracts produced by this remediation have since been redeployed to the **Ethereum Sepolia** test network and are live, with a working frontend deployment; see "Live Application & Current Deployment" below. An earlier, pre-remediation version of these contracts was also deployed to Sepolia; those addresses are kept only as a historical record, not as the current protocol, and are documented separately in "Historical Deployment" near the end of this document.

---

## 🌐 Live Application & Current Deployment (Sepolia Testnet)

**Live application:** [https://stakeverse.vercel.app/](https://stakeverse.vercel.app/)

The hardened contracts from the Steps 1-9 remediation (see "Security and Smart Contract Auditing" below) were deployed to Sepolia through a controlled, confirmation-gated GitHub Actions workflow. The full machine-readable record lives in [`deployment/sepolia.json`](deployment/sepolia.json) under `current`.

### Deployment Details
| Field | Value |
|---|---|
| Network | Ethereum Sepolia (testnet) |
| Chain ID | `11155111` |
| Deployed | `2026-09-10T01:29:39Z` |
| Deployer | `0x4Bc5db5a2e45F1a4AD111237baeede1b46746D9e` |

### Contract Addresses
*   📜 **StakeVerseToken (ERC-20):** [`0xf87d0115aF9Fc668d69c540dD7c27BC032d9Afcd`](https://eth-sepolia.blockscout.com/address/0xf87d0115aF9Fc668d69c540dD7c27BC032d9Afcd)
*   🏛️ **StakeVerseDAO:** [`0x8B555044B4c0A0a91cb0028043004d94291FD01F`](https://eth-sepolia.blockscout.com/address/0x8B555044B4c0A0a91cb0028043004d94291FD01F)
*   🥩 **StakeVerseStaking:** [`0x5EBd1259223CD30D1Ba95298b517F1F59ABBEa64`](https://eth-sepolia.blockscout.com/address/0x5EBd1259223CD30D1Ba95298b517F1F59ABBEa64)
*   🎫 **StakeVerseNFT (ERC-721):** [`0xA2C7c2db9Ca89b90994049e74d1Ea3eaB62F286C`](https://eth-sepolia.blockscout.com/address/0xA2C7c2db9Ca89b90994049e74d1Ea3eaB62F286C)
*   🔮 **PriceOracleConsumer:** [`0x5773E1acaE1Bda00caCedC5ebA1653db2C1e749F`](https://eth-sepolia.blockscout.com/address/0x5773E1acaE1Bda00caCedC5ebA1653db2C1e749F)

These links go to each contract's plain Blockscout address page. **They are not source-code-verified links.** `.github/workflows/deploy-sepolia.yml` does not run `hardhat-verify`, so Blockscout may only display raw bytecode rather than readable source until verification is performed separately.

### Ownership
`StakeVerseToken`, `StakeVerseStaking`, `StakeVerseNFT`, and `StakeVerseDAO` itself are all owned by the DAO. This was independently re-verified directly against the live chain by `deploy-sepolia.yml`'s post-deployment step (querying `owner()` on each contract from outside the deploy process), not merely asserted by `scripts/deploy.ts`'s own internal check.

### Deployment Safeguards
`.github/workflows/deploy-sepolia.yml` is a manually-triggered workflow with several independent guardrails:
*   Requires typing an exact confirmation string (`DEPLOY_SEPOLIA`) before any step runs.
*   Verifies the configured chain ID equals `11155111` before install/compile/test, and `scripts/deploy.ts` independently checks the live network's chain ID again before sending any transaction.
*   Reads `SEPOLIA_PRIVATE_KEY` and `SEPOLIA_RPC_URL` only from GitHub Actions Secrets; the private key is never exposed to the compile step and never printed to logs.
*   Re-verifies deployed bytecode and `owner()` on every contract directly against the live chain after deployment, independent of the deploy script's own assertions.

### What's Not Recorded
Transaction hashes and per-contract block numbers are **not currently captured**. `scripts/deploy.ts` does not record them, and `deployment/sepolia.json` states this explicitly rather than approximating a value.

---

## 🏗️ System Architecture

```
                       [ User / React Frontend ]
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│ StakeVerseToken  │       │  StakeVerseNFT   │       │ PriceOracleCons. │
│     (ERC-20)     │       │    (ERC-721)     │       │ (Chainlink Feed) │
└────────┬─────────┘       └────────┬─────────┘       └────────┬─────────┘
         │                          │                          │
         ▼                          ▼                          │
┌──────────────────┐       ┌──────────────────┐                │
│StakeVerseStaking │◄──────┤  StakeVerseDAO   │◄───────────────┘
│ (Fixed Rate/Time)│       │ (Voting/Actions) │ (Future Economic Extension)
└──────────────────┘       └──────────────────┘
```

### Justification of ERC Token Standards
*   **ERC-20 (`StakeVerseToken.sol`):** Chosen for the core utility and governance token due to its universal compatibility with decentralized exchanges (DEXs), AMMs, automated liquidity protocols, and market wallets (e.g., MetaMask). It allows precise fractional math required for staking rewards and voting weight distribution.
*   **ERC-721 (`StakeVerseNFT.sol`):** Chosen for the membership mechanism. Since membership profiles can hold unique metadata and governance identity traits in future expansions, a non-fungible token functions perfectly as the ecosystem's cryptographic access badge.

---

## 📂 Repository Structure

```
.
├── .github/
│   └── workflows/          # CI/CD: ci.yml (compile+test+build on every push), deploy-sepolia.yml (gated Sepolia deployment)
├── audit/                  # Automated audit reports (Slither/Mythril)
├── contracts/              # Smart Contract source code (Solidity)
│   ├── MockV3Aggregator.sol     # Mock contract for local testing environment
│   ├── PriceOracleConsumer.sol
│   ├── StakeVerseDAO.sol
│   ├── StakeVerseNFT.sol
│   ├── StakeVerseStaking.sol
│   └── StakeVerseToken.sol
├── deployment/             # Testnet deployment artifacts and addresses
│   └── sepolia.json
├── frontend/               # Web Application (React + TypeScript + Vite + Tailwind)
│   ├── src/
│   │   ├── components/     # UI Components (dashboard/, governance/, staking/, layout/)
│   │   ├── contracts/      # Per-contract ethers.js bindings + abis/
│   │   ├── hooks/          # useWallet, useDashboard, useGovernance, useVotingPower, useOracle
│   │   ├── services/       # Web3 provider abstraction (ethers.js v6)
│   │   └── utils/          # txError, calldata decoding for governance proposals
├── scripts/                # Compilation and deployment scripts (Hardhat v3)
│   └── deploy.ts
└── test/                   # Local unit tests (Mocha/Chai) — 9 files, 146 tests
    ├── dao.test.ts
    ├── staking.test.ts
    ├── token.test.ts
    ├── nft.test.ts
    ├── oracle.test.ts
    ├── governance-integration.test.ts
    ├── ownership-finalization.test.ts
    ├── token-monetary-policy.test.ts
    └── nft-issuance-policy.test.ts
```

---

## 🛠️ Tech Stack

*   **Smart Contracts:** Solidity ^0.8.x, Hardhat v3, OpenZeppelin libraries, Chainlink Data Feeds.
*   **Frontend:** React, TypeScript, Vite, Tailwind CSS, Ethers.js (v6).
*   **Testing & Auditing:** Mocha, Chai, Slither, Mythril.
*   **CI/CD:** GitHub Actions (`.github/workflows/ci.yml`, `deploy-sepolia.yml`).

---

## 🧪 Testing Suite & Code Coverage

The core modules of the protocol are validated by a unit testing suite built using **Hardhat v3**, **Mocha**, and **Chai**.

*   **Environment Configuration:** Tailored for Hardhat v3 compilation, implementing isolated network context routines via `hre.network.create()` to isolate blockchain provider state across execution loops.
*   **EVM Time Simulation:** The governance test suite (`dao.test.ts`) simulates live voting lifetimes by triggering low-level client JSON-RPC commands: `evm_increaseTime` to advance the Unix timestamp past deadlines, and `evm_mine` to forge a new block, ensuring execution rules are enforced correctly.
*   **Continuous Integration:** `.github/workflows/ci.yml` re-runs `npx hardhat compile` and `npx hardhat test` on every push, in a clean, disposable GitHub Actions environment, independent of any contributor's local machine. The most recent run against this commit lineage confirms the same **146 passing** result reproducible locally.

### 📊 Automated Code Coverage Report
Regenerated with Hardhat's own `--coverage` flag (not a third-party plugin) against the current source. Every production contract sits at **100% line/statement coverage**; the sub-100% total is entirely the test-only `MockV3Aggregator` mock, whose unused setter branches aren't exercised by every test — see `audit/hardhat_coverage.txt` for the full, reproducible output (`npx hardhat test --coverage`).

```text
╔═════════════════════════════════════════════════════════════════════════════╗
║ File Coverage                                                               ║
╟────────────────────────────────────┬────────┬─────────────┬─────────────────╢
║ File Path                          │ Line % │ Statement % │ Uncovered Lines ║
╟────────────────────────────────────┼────────┼─────────────┼─────────────────╢
║ contracts/PriceOracleConsumer.sol  │ 100.00 │ 100.00      │ -               ║
║ contracts/MockGovernanceTarget.sol │ 100.00 │ 100.00      │ -               ║
║ contracts/MockV3Aggregator.sol     │  78.57 │  78.57      │ 48, 62, 74      ║
║ contracts/StakeVerseDAO.sol        │ 100.00 │ 100.00      │ -               ║
║ contracts/StakeVerseStaking.sol    │ 100.00 │ 100.00      │ -               ║
║ contracts/StakeVerseNFT.sol        │ 100.00 │ 100.00      │ -               ║
║ contracts/StakeVerseToken.sol      │ 100.00 │ 100.00      │ -               ║
╟────────────────────────────────────┼────────┼─────────────┼─────────────────╢
║ Total                              │  98.10 │  97.67      │                 ║
╚════════════════════════════════════╧════════╧═════════════╧═════════════════╝
```

---

## ⛓️ Testing Strategy & Oracle Mocking

### 🇺🇸 Oracle Mocking Mechanism (Local Environment)
To run unit tests locally without external dependencies or an internet connection to Sepolia, `test/oracle.test.ts` uses a **Mocking** pattern:
*   **Contract Used:** `MockV3Aggregator.sol` (located under `contracts/`, test-only — never deployed by `scripts/deploy.ts`, which always targets the real feed at `CHAINLINK_PRICE_FEED` regardless of network).
*   **How it Works:** Test files deploy `MockV3Aggregator` directly and point `PriceOracleConsumer` at it, mimicking Chainlink's `AggregatorV3Interface`. The mock exposes individually-settable `setAnswer`, `setRoundId`, `setUpdatedAt`, `setAnsweredInRound`, and `setDecimals` functions (there is no single `updateAnswer` function).
*   **Objective:** This lets the test suite independently control every field `PriceOracleConsumer`'s hardened validation inspects — price, round completeness, staleness, and future-timestamp rejection — in a 100% isolated, deterministic, offline manner (EVM time is advanced explicitly via `evm_increaseTime`/`evm_mine`, never wall-clock timing).

---

## 🔒 Security and Smart Contract Auditing

**Note on this section's history:** earlier versions of this README cited specific Slither/Mythril findings (including a reference to a `withdraw` function this codebase has never had) that could not be verified as genuine tool output against this repository and were removed rather than repeated. The current security record is a structured, 9-phase manual/AI-assisted remediation and verification process — not a claim of automated static-analysis certification.

*   **Full findings record:** [`audit/SECURITY_AUDIT.md`](audit/SECURITY_AUDIT.md) — executive summary, resolved issues with evidence, accepted design risks, and documentation gaps.
*   **Verifiable evidence:** 146/146 passing tests (`npx hardhat test`), 100% line coverage on every production contract (`npx hardhat test --coverage`, raw output in `audit/hardhat_coverage.txt`), zero compiler warnings.
*   **Continuous verification:** `.github/workflows/ci.yml` re-runs the full 146-test suite on every push to a clean environment; the latest public run against this commit lineage completed with all 146 tests passing, giving evidence beyond a single local run.
*   **Centralization risk (resolved):** `Token`, `Staking`, `NFT`, and the `DAO` itself are now all owned by `StakeVerseDAO`, not the deployer. See `audit/SECURITY_AUDIT.md` for the original ownership-finalization evidence, and "Live Application & Current Deployment" above for the same check re-run independently against the current live deployment.
*   No third-party static-analysis (Slither/Mythril) or external audit firm has reviewed this codebase; none of the tooling in `audit/` was actually executable in the environment this remediation work was performed in.

---

## 📋 Known Documentation Gaps

* **The NFT does not gate anything.** `StakeVerseNFT` is a DAO-mintable ERC-721 with no supply cap and no per-address limit. Neither `StakeVerseStaking.stake()` nor `StakeVerseDAO`'s voting/proposal functions check NFT ownership. The "exclusive access" / "Sybil mitigation" / "programmed scarcity" framing in earlier versions of this document was aspirational, not implemented — it would require deliberately adding gating logic to Staking and/or the DAO, which has not been done.
* **Voting power is not proportional to staked balance.** Governance weight comes entirely from `StakeVerseToken`'s ERC20Votes delegation. Staking and governance are independent systems in this codebase.
* **The dashboard's oracle price is not live.** The frontend ships `useOracle.ts`, `OracleCard.tsx`, and `contracts/oracle.ts` for reading `PriceOracleConsumer`, but the active `Dashboard.tsx` never imports any of them. The only oracle-labeled element actually rendered on the dashboard is a stat card with a hardcoded value (`$3,412`) that never changes, regardless of the real feed's price.
* **Staking has no Unstake control in the UI.** `unstakeTokens()` exists in `frontend/src/contracts/staking.ts` and correctly calls the deployed contract's `unstake()` function, but `StakingPanel.tsx` only wires Approve, Stake, and Claim Rewards buttons. There is currently no way to withdraw staked principal from the deployed frontend.

---

## 🚀 Local Installation and Execution

### Prerequisites
*   Node.js (v18+ recommended)
*   MetaMask wallet configured for the Sepolia test network

### 1. Environment Setup (Hardhat)
```bash
npm install
cp .env.example .env
```
Configure the required keys inside your `.env` file:
```env
SEPOLIA_PRIVATE_KEY=your_private_key_here
SEPOLIA_RPC_URL=your_rpc_endpoint_here
```

### 2. Compilation and Testing
```bash
npx hardhat compile
npx hardhat test
```

### 3. Frontend Execution
The frontend reads five contract addresses from Vite environment variables at build/run time (`frontend/src/contracts/index.ts`). Create `frontend/.env.local` (git-ignored, not committed) with the current deployment's addresses, sourced from [`deployment/sepolia.json`](deployment/sepolia.json) → `current`:
```env
VITE_TOKEN_ADDRESS=0xf87d0115aF9Fc668d69c540dD7c27BC032d9Afcd
VITE_DAO_ADDRESS=0x8B555044B4c0A0a91cb0028043004d94291FD01F
VITE_STAKING_ADDRESS=0x5EBd1259223CD30D1Ba95298b517F1F59ABBEa64
VITE_NFT_ADDRESS=0xA2C7c2db9Ca89b90994049e74d1Ea3eaB62F286C
VITE_ORACLE_ADDRESS=0x5773E1acaE1Bda00caCedC5ebA1653db2C1e749F
```
Then run:
```bash
cd frontend
npm install
npm run dev
```

---

## 🕰️ Historical Deployment (Pre-Remediation)

The addresses below were deployed **before** the Steps 1-9 security remediation described in [`audit/SECURITY_AUDIT.md`](audit/SECURITY_AUDIT.md). Their live bytecode does **not** match the current contract source in this repository. They are kept here only as a historical record, matching the `history` entry in [`deployment/sepolia.json`](deployment/sepolia.json), and should not be treated as the current, audited protocol. For the current deployment, see "Live Application & Current Deployment" above.

*   📜 StakeVerseToken: [`0x1695059AE16EA39f66978a63e5199E8BBa7e76C1`](https://eth-sepolia.blockscout.com/address/0x1695059AE16EA39f66978a63e5199E8BBa7e76C1)
*   🎫 StakeVerseNFT: [`0x499530539E80b26A573c6C5c0583e4067dcCd836`](https://eth-sepolia.blockscout.com/address/0x499530539E80b26A573c6C5c0583e4067dcCd836)
*   🥩 StakeVerseStaking: [`0xbAd2743efbA270CCB844015C28213932D9e36E33`](https://eth-sepolia.blockscout.com/address/0xbAd2743efbA270CCB844015C28213932D9e36E33)
*   🏛️ StakeVerseDAO: [`0xE500041A14Bbea0a1aD7AC36b59f99BdAfC80E55`](https://eth-sepolia.blockscout.com/address/0xE500041A14Bbea0a1aD7AC36b59f99BdAfC80E55)
*   🔮 PriceOracleConsumer: [`0x0985528C81c29cb268dE13AB7D2eFAb88DCd4A02`](https://eth-sepolia.blockscout.com/address/0x0985528C81c29cb268dE13AB7D2eFAb88DCd4A02)

---

# 🇧🇷 Português

## 📌 Sobre o Projeto
O **StakeVerse Protocol** é um ecossistema Web3 descentralizado e modular desenvolvido como MVP para a disciplina de *Desenvolvimento de Protocolo Web3 Completo com Deploy em Testnet* (Fase 2 Avançada — Unidade 1 | Capítulo 5). 

O protocolo resolve o problema da fragmentação e da baixa participação em DAOs ao mitigar o custo de oportunidade por meio de um ecossistema de incentivos circular e modular:
*   **Tokenomics Integrado:** Usuários utilizam o token utilitário nativo para travar em contratos de staking e gerar rendimento cíclico.
*   **NFT de Membership:** Existe uma credencial ERC-721 emitida pela DAO (`StakeVerseNFT`), mas, na implementação atual, ela **não** condiciona o staking nem a participação na governança, e a emissão não possui limite/escassez — ver "Lacunas de Documentação Conhecidas" abaixo.
*   **Governança Ativa:** O poder de voto vem da delegação ERC20Votes do `StakeVerseToken`, com snapshot por proposta. É independente do staking — travar um token em staking não concede peso de voto especial, e um token não travado, porém delegado, vota exatamente da mesma forma.

O protocolo passou por um processo estruturado e multifásico de remediação e verificação de segurança (contabilidade de staking, poder de voto/governança, quórum/limiar de propostas, validação do oráculo Chainlink, mecanismo de pausa de emergência, finalização da propriedade para a DAO e revisão da política monetária/de emissão), evidenciado por uma suíte de regressão automatizada com 146 testes. Veja [`audit/SECURITY_AUDIT.md`](audit/SECURITY_AUDIT.md) para o registro completo de achados. Os contratos reforçados produzidos por essa remediação já foram reimplantados na rede de testes **Ethereum Sepolia** e estão no ar, com um frontend funcional; veja "Aplicação em Produção e Deploy Atual" abaixo. Uma versão anterior, pré-remediação, também foi implantada na Sepolia; esses endereços são mantidos apenas como registro histórico, não como o protocolo atual, e estão documentados separadamente em "Deploy Histórico" perto do final deste documento.

---

## 🌐 Aplicação em Produção e Deploy Atual (Sepolia Testnet)

**Aplicação em produção:** [https://stakeverse.vercel.app/](https://stakeverse.vercel.app/)

Os contratos reforçados pela remediação das Etapas 1-9 (ver "Segurança e Relatório de Auditoria" abaixo) foram implantados na Sepolia por meio de um workflow do GitHub Actions controlado e com confirmação obrigatória. O registro completo, em formato legível por máquina, está em [`deployment/sepolia.json`](deployment/sepolia.json), na chave `current`.

### Detalhes do Deploy
| Campo | Valor |
|---|---|
| Rede | Ethereum Sepolia (testnet) |
| Chain ID | `11155111` |
| Implantado em | `2026-09-10T01:29:39Z` |
| Deployer | `0x4Bc5db5a2e45F1a4AD111237baeede1b46746D9e` |

### Endereços dos Contratos
*   📜 **StakeVerseToken (ERC-20):** [`0xf87d0115aF9Fc668d69c540dD7c27BC032d9Afcd`](https://eth-sepolia.blockscout.com/address/0xf87d0115aF9Fc668d69c540dD7c27BC032d9Afcd)
*   🏛️ **StakeVerseDAO:** [`0x8B555044B4c0A0a91cb0028043004d94291FD01F`](https://eth-sepolia.blockscout.com/address/0x8B555044B4c0A0a91cb0028043004d94291FD01F)
*   🥩 **StakeVerseStaking:** [`0x5EBd1259223CD30D1Ba95298b517F1F59ABBEa64`](https://eth-sepolia.blockscout.com/address/0x5EBd1259223CD30D1Ba95298b517F1F59ABBEa64)
*   🎫 **StakeVerseNFT (ERC-721):** [`0xA2C7c2db9Ca89b90994049e74d1Ea3eaB62F286C`](https://eth-sepolia.blockscout.com/address/0xA2C7c2db9Ca89b90994049e74d1Ea3eaB62F286C)
*   🔮 **PriceOracleConsumer:** [`0x5773E1acaE1Bda00caCedC5ebA1653db2C1e749F`](https://eth-sepolia.blockscout.com/address/0x5773E1acaE1Bda00caCedC5ebA1653db2C1e749F)

Esses links levam à página de endereço simples de cada contrato no Blockscout. **Eles não são links de código-fonte verificado.** O `.github/workflows/deploy-sepolia.yml` não executa `hardhat-verify`, então o Blockscout pode exibir apenas o bytecode bruto, não o código-fonte legível, até que a verificação seja feita separadamente.

### Propriedade (Ownership)
`StakeVerseToken`, `StakeVerseStaking`, `StakeVerseNFT` e a própria `StakeVerseDAO` pertencem todos à DAO. Isso foi reverificado de forma independente, diretamente contra a rede viva, pela etapa de pós-deploy do `deploy-sepolia.yml` (consultando `owner()` em cada contrato, fora do processo de deploy), e não apenas afirmado pela checagem interna do próprio `scripts/deploy.ts`.

### Salvaguardas do Pipeline de Deploy
O `.github/workflows/deploy-sepolia.yml` é um workflow disparado manualmente, com várias salvaguardas independentes:
*   Exige digitar uma string de confirmação exata (`DEPLOY_SEPOLIA`) antes de qualquer etapa rodar.
*   Verifica se o chain ID configurado é `11155111` antes de instalar/compilar/testar, e o `scripts/deploy.ts` verifica de forma independente o chain ID da rede ao vivo novamente antes de enviar qualquer transação.
*   Lê `SEPOLIA_PRIVATE_KEY` e `SEPOLIA_RPC_URL` apenas dos Secrets do GitHub Actions; a chave privada nunca é exposta à etapa de compilação e nunca é impressa nos logs.
*   Reverifica o bytecode implantado e o `owner()` de cada contrato diretamente contra a rede viva após o deploy, independentemente das próprias asserções do script de deploy.

### O Que Não Está Registrado
Hashes de transação e números de bloco por contrato **não são capturados atualmente**. O `scripts/deploy.ts` não os registra, e o `deployment/sepolia.json` afirma isso explicitamente, em vez de aproximar um valor.

---

## 🏗️ Arquitetura do Sistema

```
                       [ Usuário / Frontend React ]
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│ StakeVerseToken  │       │  StakeVerseNFT   │       │ PriceOracleCons. │
│     (ERC-20)     │       │    (ERC-721)     │       │ (Chainlink Feed) │
└────────┬─────────┘       └────────┬─────────┘       └────────┬─────────┘
         │                          │                          │
         ▼                          ▼                          │
┌──────────────────┐       ┌──────────────────┐                │
│StakeVerseStaking │◄──────┤  StakeVerseDAO   │◄───────────────┘
│ (Taxa Fixa/Tempo)│       │ (Votação/Ações)  │ (Futura Extensão Econômica)
└──────────────────┘       └──────────────────┘
```

### Justificativa dos Padrões ERC Escolhidos
*   **ERC-20 (`StakeVerseToken.sol`):** Utilizado para o token utilitário e de governança devido à sua compatibilidade universal com exchanges descentralizadas (DEXs), AMMs e carteiras do mercado (como MetaMask). Permite o fracionamento preciso para cálculo de recompensas de staking e distribuição do peso de votos.
*   **ERC-721 (`StakeVerseNFT.sol`):** Escolhido para o mecanismo de membership (participação). Como cada título de membro pode conter metadados e IDs únicos de governança em expansões futures, o padrão não-fungível atua perfeitamente como o "crachá de acesso" criptográfico do ecossistema.

---

## 📂 Estrutura do Repositório

```
.
├── .github/
│   └── workflows/          # CI/CD: ci.yml (compila+testa+builda a cada push), deploy-sepolia.yml (deploy controlado na Sepolia)
├── audit/                  # Relatórios de auditoria automatizada (Slither/Mythril)
├── contracts/              # Código-fonte dos Contratos Inteligentes (Solidity)
│   ├── MockV3Aggregator.sol     # Contrato Mock para simulação local do Oráculo
│   ├── PriceOracleConsumer.sol
│   ├── StakeVerseDAO.sol
│   ├── StakeVerseNFT.sol
│   ├── StakeVerseStaking.sol
│   └── StakeVerseToken.sol
├── deployment/             # Artefatos e endereços do deploy em testnet
│   └── sepolia.json
├── frontend/               # Aplicação Web (React + TypeScript + Vite + Tailwind)
│   ├── src/
│   │   ├── components/     # Componentes de UI (dashboard/, governance/, staking/, layout/)
│   │   ├── contracts/      # Bindings ethers.js por contrato + abis/
│   │   ├── hooks/          # useWallet, useDashboard, useGovernance, useVotingPower, useOracle
│   │   ├── services/       # Abstração do provedor Web3 via ethers.js v6
│   │   └── utils/          # txError, decodificação de calldata de propostas de governança
├── scripts/                # Scripts de compilação e deploy (Hardhat v3)
│   └── deploy.ts
└── test/                   # Testes unitários locais (Mocha/Chai) — 9 arquivos, 146 testes
    ├── dao.test.ts
    ├── staking.test.ts
    ├── token.test.ts
    ├── nft.test.ts
    ├── oracle.test.ts
    ├── governance-integration.test.ts
    ├── ownership-finalization.test.ts
    ├── token-monetary-policy.test.ts
    └── nft-issuance-policy.test.ts
```

---

## 🛠️ Tecnologias Utilizadas

*   **Smart Contracts:** Solidity ^0.8.x, Hardhat v3, OpenZeppelin, Chainlink Data Feeds.
*   **Frontend:** React, TypeScript, Vite, Tailwind CSS, Ethers.js (v6).
*   **Testes & Auditoria:** Mocha, Chai, Slither, Mythril.
*   **CI/CD:** GitHub Actions (`.github/workflows/ci.yml`, `deploy-sepolia.yml`).

---

## 🧪 Suíte de Testes & Cobertura de Código

Os módulos principais do protocolo são validados por uma suíte completa de testes unitários desenvolvida em **Hardhat v3**, **Mocha** e **Chai**.

*   **Configuração de Ambiente:** Adaptado para as regras de compilação do Hardhat v3, implementando rotinas isoladas de contexto de rede via `hre.network.create()` para segregar o estado do provider blockchain a cada loop de execução.
*   **Simulação de Passagem de Tempo na EVM:** A suíte de testes de governança (`dao.test.ts`) simula os prazos de vigência das propostas enviando comandos JSON-RPC de baixo nível ao cliente local: `evm_increaseTime` para avançar o relógio Unix e `evm_mine` para forçar a criação de um bloco subsequente, garantindo o teste preciso das regras de expiração.
*   **Integração Contínua:** O `.github/workflows/ci.yml` roda novamente `npx hardhat compile` e `npx hardhat test` a cada push, em um ambiente limpo e descartável do GitHub Actions, independente da máquina local de qualquer contribuidor. A execução mais recente sobre esta linhagem de commits confirma o mesmo resultado de **146 passing**, reproduzível localmente.

### 📊 Relatório Automatizado de Cobertura (Code Coverage)
Regenerado com a flag nativa `--coverage` do Hardhat (não um plugin de terceiros) contra o código-fonte atual. Todo contrato de produção está em **100% de cobertura de linhas/statements**; o total abaixo de 100% vem inteiramente do mock de teste `MockV3Aggregator`, cujos setters não utilizados não são exercitados por todos os testes — veja `audit/hardhat_coverage.txt` para a saída completa e reproduzível (`npx hardhat test --coverage`).

```text
╔═════════════════════════════════════════════════════════════════════════════╗
║ File Coverage                                                               ║
╟────────────────────────────────────┬────────┬─────────────┬─────────────────╢
║ File Path                          │ Line % │ Statement % │ Uncovered Lines ║
╟────────────────────────────────────┼────────┼─────────────┼─────────────────╢
║ contracts/PriceOracleConsumer.sol  │ 100.00 │ 100.00      │ -               ║
║ contracts/MockGovernanceTarget.sol │ 100.00 │ 100.00      │ -               ║
║ contracts/MockV3Aggregator.sol     │  78.57 │  78.57      │ 48, 62, 74      ║
║ contracts/StakeVerseDAO.sol        │ 100.00 │ 100.00      │ -               ║
║ contracts/StakeVerseStaking.sol    │ 100.00 │ 100.00      │ -               ║
║ contracts/StakeVerseNFT.sol        │ 100.00 │ 100.00      │ -               ║
║ contracts/StakeVerseToken.sol      │ 100.00 │ 100.00      │ -               ║
╟────────────────────────────────────┼────────┼─────────────┼─────────────────╢
║ Total                              │  98.10 │  97.67      │                 ║
╚════════════════════════════════════╧════════╧═════════════╧═════════════════╝
```

---

## ⛓️ Estratégia de Testes Local vs. Testnet (Oráculos)

### 🇧🇷 Mecanismo de Mocking para Oráculo (Ambiente Local)
Para que os testes unitários funcionem localmente sem depender de conexões externas ou internet ativa com a rede Sepolia, `test/oracle.test.ts` usa um padrão de **Mocking**:
*   **Contrato Utilizado:** `MockV3Aggregator.sol` (localizado em `contracts/`, exclusivo para testes — nunca implantado por `scripts/deploy.ts`, que sempre aponta para o feed real em `CHAINLINK_PRICE_FEED`, independentemente da rede).
*   **Como Funciona:** Os arquivos de teste implantam `MockV3Aggregator` diretamente e apontam o `PriceOracleConsumer` para ele, emulando a interface `AggregatorV3Interface` da Chainlink. O mock expõe funções individuais `setAnswer`, `setRoundId`, `setUpdatedAt`, `setAnsweredInRound` e `setDecimals` (não existe uma única função `updateAnswer`).
*   **Objetivo:** Isso permite que a suíte de testes controle independentemente cada campo verificado pela validação reforçada do `PriceOracleConsumer` — preço, integridade da rodada, obsolescência (staleness) e rejeição de timestamp futuro — de forma 100% isolada, determinística e offline (o tempo da EVM é avançado explicitamente via `evm_increaseTime`/`evm_mine`, nunca por tempo de relógio real).

---

## 🔒 Segurança e Relatório de Auditoria (Smart Contracts)

**Nota sobre o histórico desta seção:** versões anteriores deste README citavam achados específicos de Slither/Mythril (incluindo uma referência a uma função `withdraw` que este código nunca teve) que não puderam ser verificados como saída genuína de ferramentas contra este repositório, e foram removidos em vez de repetidos. O registro de segurança atual é um processo estruturado de remediação e verificação em 9 fases, manual/assistido por IA — não uma alegação de certificação por análise estática automatizada.

*   **Registro completo de achados:** [`audit/SECURITY_AUDIT.md`](audit/SECURITY_AUDIT.md) — resumo executivo, problemas resolvidos com evidências, riscos de design aceitos e lacunas de documentação.
*   **Evidência verificável:** 146/146 testes passando (`npx hardhat test`), 100% de cobertura de linhas em todo contrato de produção (`npx hardhat test --coverage`, saída bruta em `audit/hardhat_coverage.txt`), zero warnings de compilação.
*   **Verificação contínua:** O `.github/workflows/ci.yml` roda novamente a suíte completa de 146 testes a cada push, em ambiente limpo; a execução pública mais recente sobre esta linhagem de commits terminou com os 146 testes passando, oferecendo evidência além de uma única execução local.
*   **Risco de centralização (resolvido):** `Token`, `Staking`, `NFT` e a própria `DAO` agora pertencem à `StakeVerseDAO`, não ao deployer. Veja `audit/SECURITY_AUDIT.md` para a evidência original da finalização da propriedade, e "Aplicação em Produção e Deploy Atual" acima para a mesma checagem reexecutada de forma independente no deploy atual.
*   Nenhuma análise estática de terceiros (Slither/Mythril) ou auditoria externa revisou este código; as ferramentas antes referenciadas em `audit/` não eram de fato executáveis no ambiente onde este trabalho de remediação foi realizado.

---

## 📋 Lacunas de Documentação Conhecidas

* **O NFT não condiciona nada.** `StakeVerseNFT` é um ERC-721 mintável pela DAO, sem limite de supply e sem limite por endereço. Nem `StakeVerseStaking.stake()` nem as funções de voto/proposta da `StakeVerseDAO` verificam a posse do NFT. O enquadramento de "acesso exclusivo" / "mitigação de Sybil" / "escassez programada" em versões anteriores deste documento era aspiracional, não implementado — exigiria adicionar deliberadamente lógica de restrição ao Staking e/ou à DAO, o que não foi feito.
* **O poder de voto não é proporcional ao saldo em staking.** O peso de governança vem inteiramente da delegação ERC20Votes do `StakeVerseToken`. Staking e governança são sistemas independentes neste código.
* **O preço do oráculo no painel não é ao vivo.** O frontend possui `useOracle.ts`, `OracleCard.tsx` e `contracts/oracle.ts` para ler o `PriceOracleConsumer`, mas o `Dashboard.tsx` ativo nunca importa nenhum deles. O único elemento rotulado como "oráculo" de fato renderizado no painel é um cartão de estatística com um valor fixo no código (`$3.412`), que nunca muda, independentemente do preço real do feed.
* **O Staking não tem controle de Unstake na interface.** A função `unstakeTokens()` existe em `frontend/src/contracts/staking.ts` e chama corretamente a função `unstake()` do contrato implantado, mas o `StakingPanel.tsx` só conecta os botões Approve, Stake e Claim Rewards. Atualmente não há como resgatar o principal em staking a partir do frontend implantado.

---

## 🚀 Instalação e Execução Local

### Pré-requisitos
*   Node.js (v18+ recomendado)
*   Carteira MetaMask configurada para a rede Sepolia

### 1. Configuração do Ambiente (Hardhat)
```bash
npm install
cp .env.example .env
```
Configure as chaves necessárias no seu arquivo `.env`:
```env
SEPOLIA_PRIVATE_KEY=sua_chave_privada_aqui
SEPOLIA_RPC_URL=seu_endpoint_rpc_aqui
```

### 2. Compilação e Testes
```bash
npx hardhat compile
npx hardhat test
```

### 3. Execução do Frontend
O frontend lê cinco endereços de contrato a partir de variáveis de ambiente do Vite, em tempo de build/execução (`frontend/src/contracts/index.ts`). Crie um arquivo `frontend/.env.local` (ignorado pelo git, não commitado) com os endereços do deploy atual, obtidos de [`deployment/sepolia.json`](deployment/sepolia.json) → `current`:
```env
VITE_TOKEN_ADDRESS=0xf87d0115aF9Fc668d69c540dD7c27BC032d9Afcd
VITE_DAO_ADDRESS=0x8B555044B4c0A0a91cb0028043004d94291FD01F
VITE_STAKING_ADDRESS=0x5EBd1259223CD30D1Ba95298b517F1F59ABBEa64
VITE_NFT_ADDRESS=0xA2C7c2db9Ca89b90994049e74d1Ea3eaB62F286C
VITE_ORACLE_ADDRESS=0x5773E1acaE1Bda00caCedC5ebA1653db2C1e749F
```
Em seguida, execute:
```bash
cd frontend
npm install
npm run dev
```

---

## 🕰️ Deploy Histórico (Pré-Remediação)

Os endereços abaixo foram implantados **antes** do processo de remediação de segurança das Etapas 1-9, descrito em [`audit/SECURITY_AUDIT.md`](audit/SECURITY_AUDIT.md). O bytecode ao vivo nesses endereços **não** corresponde ao código-fonte atual deste repositório. Eles são mantidos aqui apenas como registro histórico, correspondendo à entrada `history` em [`deployment/sepolia.json`](deployment/sepolia.json), e não devem ser tratados como o protocolo atual e auditado. Para o deploy atual, veja "Aplicação em Produção e Deploy Atual" acima.

*   📜 StakeVerseToken: [`0x1695059AE16EA39f66978a63e5199E8BBa7e76C1`](https://eth-sepolia.blockscout.com/address/0x1695059AE16EA39f66978a63e5199E8BBa7e76C1)
*   🎫 StakeVerseNFT: [`0x499530539E80b26A573c6C5c0583e4067dcCd836`](https://eth-sepolia.blockscout.com/address/0x499530539E80b26A573c6C5c0583e4067dcCd836)
*   🥩 StakeVerseStaking: [`0xbAd2743efbA270CCB844015C28213932D9e36E33`](https://eth-sepolia.blockscout.com/address/0xbAd2743efbA270CCB844015C28213932D9e36E33)
*   🏛️ StakeVerseDAO: [`0xE500041A14Bbea0a1aD7AC36b59f99BdAfC80E55`](https://eth-sepolia.blockscout.com/address/0xE500041A14Bbea0a1aD7AC36b59f99BdAfC80E55)
*   🔮 PriceOracleConsumer: [`0x0985528C81c29cb268dE13AB7D2eFAb88DCd4A02`](https://eth-sepolia.blockscout.com/address/0x0985528C81c29cb268dE13AB7D2eFAb88DCd4A02)

---

## 🖼️ Application Interface / Interface da Aplicação

### Main Dashboard / Painel Principal
![StakeVerse Dashboard](frontend/public/screenshots/dashboard.png)
* **🇺🇸 EN:** Main protocol user interface, featuring decentralized wallet connection status, staking interactions (approve/deposit), real-time reward distribution tracking, and active DAO proposal mechanics.
* **🇧🇷 PT-BR:** Interface principal do usuário do protocolo, apresentando status de conexão de carteira descentralizada, interações de staking (aprovação/depósito), rastreamento de distribuição de recompensas em tempo real e mecânicas de propostas ativas da DAO.
