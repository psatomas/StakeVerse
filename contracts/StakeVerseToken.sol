// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @notice Inheritance note (OpenZeppelin v5.6.1):
/// ERC20Votes already extends ERC20 and overrides `_update` to checkpoint
/// voting power on every mint/burn/transfer; StakeVerseToken does not
/// otherwise override `_update`, so there is no diamond-inheritance conflict
/// and no additional override is required here. `Votes` (the base of
/// ERC20Votes) also already extends `Nonces`, so `nonces()` (needed for
/// `delegateBySig`) is provided as-is with no further override needed.
/// `Votes` extends `EIP712`, whose constructor must still be called
/// explicitly below to set the signing domain used by `delegateBySig`.
contract StakeVerseToken is ERC20Votes, Ownable {

    uint256 public constant INITIAL_SUPPLY = 1_000_000 * 10 ** 18;

    constructor(address initialOwner)
        ERC20("StakeVerse Token", "SVT")
        EIP712("StakeVerse Token", "1")
        Ownable(initialOwner)
    {
        _mint(initialOwner, INITIAL_SUPPLY);
        // Deliberately NOT self-delegating here: ERC20Votes delegation stays
        // fully explicit. Minted/held tokens carry no voting power until the
        // holder calls delegate() (to themselves or someone else) — this is
        // upstream ERC20Votes behavior, kept as-is rather than papered over.
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @dev Switches the ERC-6372 clock from block-number mode (the
    /// ERC20Votes/Votes default) to timestamp mode, so that voting-power
    /// snapshots line up with StakeVerseDAO's existing timestamp-based
    /// proposal deadlines instead of mixing block numbers and seconds.
    function clock() public view override returns (uint48) {
        return uint48(block.timestamp);
    }

    // solhint-disable-next-line func-name-mixedcase
    function CLOCK_MODE() public pure override returns (string memory) {
        return "mode=timestamp";
    }
}
