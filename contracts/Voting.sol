// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * Voting.sol
 * Decentralized voting contract for: "Which topic should the next tech workshop cover?"
 * Options: AI Agents, Blockchain Security, Cloud Computing
 */
contract Voting {
    address public owner;
    string[] public options;
    uint256 public votingEndTime;
    bool public paused;

    mapping(uint256 => uint256) public voteCounts;   // optionIndex => count
    mapping(address => bool) public hasVoted;
    mapping(address => bool) public blocked;

    event VoteCast(address indexed voter, uint256 indexed optionIndex, string optionName);
    event VoterBlocked(address indexed voter, address indexed by);
    event VoterUnblocked(address indexed voter, address indexed by);
    event VotingPaused(address indexed by);
    event VotingResumed(address indexed by);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only admin can perform this action");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Voting is currently paused");
        _;
    }

    modifier beforeDeadline() {
        require(block.timestamp <= votingEndTime, "Voting deadline has passed");
        _;
    }

    /// @param _votingDurationSeconds how long (in seconds) voting stays open from deployment
    constructor(uint256 _votingDurationSeconds) {
        owner = msg.sender;
        options.push("AI Agents");
        options.push("Blockchain Security");
        options.push("Cloud Computing");
        votingEndTime = block.timestamp + _votingDurationSeconds;
        paused = false;
    }

    /// @notice Cast a vote for an option (0 = AI Agents, 1 = Blockchain Security, 2 = Cloud Computing)
    function vote(uint256 optionIndex) external whenNotPaused beforeDeadline {
        require(!blocked[msg.sender], "This account is blocked from voting");
        require(!hasVoted[msg.sender], "This account has already voted");
        require(optionIndex < options.length, "Invalid option index");

        hasVoted[msg.sender] = true;
        voteCounts[optionIndex] += 1;

        emit VoteCast(msg.sender, optionIndex, options[optionIndex]);
    }

    function getOptions() external view returns (string[] memory) {
        return options;
    }

    function getVotes(uint256 optionIndex) external view returns (uint256) {
        require(optionIndex < options.length, "Invalid option index");
        return voteCounts[optionIndex];
    }

    /// @notice Returns option names and their vote counts together, index-aligned
    function getAllResults() external view returns (string[] memory, uint256[] memory) {
        uint256 len = options.length;
        uint256[] memory counts = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            counts[i] = voteCounts[i];
        }
        return (options, counts);
    }

    /// @notice Determines the winner. If two or more options are tied for first, isTie = true.
    function getWinner() external view returns (string memory winnerName, uint256 winningVotes, bool isTie) {
        uint256 len = options.length;
        uint256 highest = 0;
        uint256 winnerIndex = 0;
        uint256 tieCount = 0;

        for (uint256 i = 0; i < len; i++) {
            if (voteCounts[i] > highest) {
                highest = voteCounts[i];
                winnerIndex = i;
                tieCount = 1;
            } else if (voteCounts[i] == highest && highest > 0) {
                tieCount += 1;
            }
        }

        isTie = tieCount > 1;
        winningVotes = highest;
        winnerName = isTie ? "TIE" : options[winnerIndex];
    }

    // ---------------- Admin controls ----------------

    function blockVoter(address voter) external onlyOwner {
        require(!blocked[voter], "Voter already blocked");
        blocked[voter] = true;
        emit VoterBlocked(voter, msg.sender);
    }

    function unblockVoter(address voter) external onlyOwner {
        require(blocked[voter], "Voter not blocked");
        blocked[voter] = false;
        emit VoterUnblocked(voter, msg.sender);
    }

    function pauseVoting() external onlyOwner {
        require(!paused, "Voting already paused");
        paused = true;
        emit VotingPaused(msg.sender);
    }

    function resumeVoting() external onlyOwner {
        require(paused, "Voting is not paused");
        paused = false;
        emit VotingResumed(msg.sender);
    }

    // ---------------- View helpers ----------------

    function isBlocked(address voter) external view returns (bool) {
        return blocked[voter];
    }

    function timeRemaining() external view returns (uint256) {
        if (block.timestamp >= votingEndTime) return 0;
        return votingEndTime - block.timestamp;
    }
}