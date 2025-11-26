# Audit Company Contact Guide - Paimon Yield Protocol

**Date**: 2025-11-26
**Version**: 1.0

---

## Recommended Audit Firms

### Option 1: Trail of Bits (Primary Recommendation)

**Company Overview**
- Founded: 2012
- Headquarters: New York, USA
- Expertise: Smart contracts, blockchain security, cryptography
- Notable Clients: MakerDAO, Compound, Uniswap, Balancer

**Contact Information**
- Website: https://www.trailofbits.com/
- Audit Request Form: https://www.trailofbits.com/contact
- Email: services@trailofbits.com

**Why Trail of Bits**
- Deep expertise in ERC4626 vault security
- Developed Slither (which we use for static analysis)
- Strong track record with DeFi protocols
- Thorough manual review process

**Estimated Cost**: $100,000 - $150,000 (4-6 weeks)

**Request Process**
1. Fill out audit request form on website
2. Provide project overview and codebase size
3. Wait for initial assessment (1-2 weeks)
4. Receive proposal and timeline
5. Sign engagement letter
6. Provide repository access

---

### Option 2: OpenZeppelin

**Company Overview**
- Founded: 2015
- Headquarters: Distributed (Global)
- Expertise: Smart contracts, OpenZeppelin libraries, security
- Notable Clients: Coinbase, Ethereum Foundation, Compound

**Contact Information**
- Website: https://www.openzeppelin.com/
- Security Services: https://www.openzeppelin.com/security-audits
- Email: security-audits@openzeppelin.com

**Why OpenZeppelin**
- We use their libraries (ERC4626, AccessControl, Pausable)
- Deep familiarity with their own code patterns
- Industry standard for DeFi audits
- Comprehensive documentation of findings

**Estimated Cost**: $80,000 - $120,000 (4-6 weeks)

**Request Process**
1. Submit inquiry via security audits page
2. Complete questionnaire about project
3. Schedule discovery call
4. Receive proposal
5. Sign SOW (Statement of Work)
6. Kick-off meeting

---

### Option 3: Consensys Diligence

**Company Overview**
- Part of Consensys
- Expertise: Ethereum ecosystem, smart contracts
- Notable Clients: Aave, Gnosis, 0x Protocol

**Contact Information**
- Website: https://consensys.io/diligence
- Contact: diligence@consensys.net

**Estimated Cost**: $70,000 - $100,000

---

### Option 4: Spearbit

**Company Overview**
- Network of independent security researchers
- Flexible engagement models
- Expertise: DeFi, NFTs, bridges

**Contact Information**
- Website: https://spearbit.com/
- Contact via website form

**Estimated Cost**: $60,000 - $100,000

---

## Contact Email Template

Subject: Audit Request - Paimon Yield Protocol (ERC4626 Vault)

```
Dear [Audit Firm] Security Team,

We are seeking a comprehensive security audit for Paimon Yield Protocol,
an ERC4626-compliant tokenized vault for RWA yield aggregation on BNB
Smart Chain.

PROJECT OVERVIEW:
- Protocol Type: DeFi Yield Vault
- Token Standard: ERC4626
- Network: BNB Smart Chain (BSC)
- Total LOC: ~2,540 lines

CONTRACTS IN SCOPE:
1. PNGYVault.sol (~1,400 LOC) - Core vault with RWA integration
2. AssetRegistry.sol (~370 LOC) - RWA asset management
3. OracleAdapter.sol (~330 LOC) - Dual oracle with failover
4. SwapHelper.sol (~180 LOC) - DEX integration
5. RebalanceStrategy.sol (~260 LOC) - Portfolio rebalancing

KEY FEATURES:
- ERC4626 deposit/withdraw/redeem
- T+1 withdrawal queue for large withdrawals
- Circuit breaker for NAV protection
- Multi-oracle price feeds with failover
- Admin-controlled rebalancing

INTERNAL PREPARATION:
- 97%+ test coverage
- Slither static analysis completed
- Mythril symbolic execution completed
- Internal security review documented

TIMELINE:
- Preferred start: [DATE]
- Target completion: 4-6 weeks

BUDGET:
$80,000 - $150,000 (flexible based on scope)

We have prepared comprehensive audit documentation including:
- Detailed audit scope document
- Architecture diagrams
- Known risks and design decisions
- Static analysis reports
- Test coverage reports

Please let us know your availability and the process to proceed with
an engagement proposal.

Best regards,
[Your Name]
Paimon Yield Protocol Team
[Email]
[Phone]
```

---

## Engagement Checklist

### Before First Contact
- [ ] Audit scope document finalized
- [ ] Budget approved by stakeholders
- [ ] Timeline flexibility confirmed
- [ ] Technical contact assigned
- [ ] NDA template prepared (if needed)

### During Negotiation
- [ ] Compare proposals from multiple firms
- [ ] Clarify deliverables (report format, severity definitions)
- [ ] Confirm communication protocols
- [ ] Agree on remediation re-review scope
- [ ] Review SOW/engagement letter carefully

### Contract Terms to Verify
- [ ] Scope boundaries clearly defined
- [ ] Payment milestones (e.g., 50% upfront, 50% on completion)
- [ ] Confidentiality terms
- [ ] Report ownership and publication rights
- [ ] Remediation re-review included
- [ ] Extension/change request process

---

## Comparison Matrix

| Criteria | Trail of Bits | OpenZeppelin | Consensys | Spearbit |
|----------|--------------|--------------|-----------|----------|
| ERC4626 Experience | Excellent | Excellent | Good | Good |
| DeFi Track Record | Excellent | Excellent | Excellent | Good |
| Timeline | 4-6 weeks | 4-6 weeks | 4-6 weeks | 3-5 weeks |
| Cost Range | $100K-$150K | $80K-$120K | $70K-$100K | $60K-$100K |
| Report Quality | Excellent | Excellent | Very Good | Good |
| Remediation Support | Included | Included | Included | Varies |

---

## Decision Recommendation

**Primary Choice**: Trail of Bits or OpenZeppelin

**Rationale**:
1. Both have extensive experience with ERC4626 vaults
2. Strong reputation enhances protocol credibility
3. Thorough review process catches more issues
4. High-quality reports suitable for public disclosure
5. Budget aligns with project allocation

**Suggested Approach**:
1. Contact both Trail of Bits and OpenZeppelin
2. Request proposals from each
3. Compare timelines, costs, and specific expertise
4. Select based on availability and fit

---

*Last Updated: 2025-11-26*
