const getMultiplier = (timestamp) => {
  const timestampFor33 = 1717961485;
  const timestampFor22 = 1717961485;

  if (timestamp < timestampFor33) {
    return 33;
  } else if (timestamp < timestampFor22) {
    return 22;
  } else {
    return 11;
  }
};

const modifyEra2Contributions = (contributions) => {
  const modifiedContributions = contributions.map((contribution) => {
    return {
      era: 2,
      walletAddress: contribution.user?.address,
      transactionHash: contribution.transactionHash,
      timestamp: contribution.timestamp,
      contributionTokenAddress: contribution.token,
      totalContributionTokenAmount: contribution.amount,
      darkXTokenAmount: contribution.amount / Math.pow(10, 18),
    };
  });
  return modifiedContributions;
};

const generateEra2Points = (contributions, era1Contributions) => {
  const era1ContributionUsers = new Set(
    era1Contributions.map((contribution) => contribution.walletAddress)
  );

  let pointsList = [];
  let rewardMultiplier = 1;
  contributions.forEach((contribution) => {
    const multiplier = getMultiplier(contribution.timestamp);
    if (era1ContributionUsers.has(contribution.walletAddress)) {
      rewardMultiplier = secrets?.ERA_2_REWARD_MULTIPLIER || 2;
    }

    pointsList.push({
      era: 2,
      walletAddress: contribution.walletAddress,
      contributionId: contribution._id,
      multiplier,
      points: contribution.darkXTokenAmount * multiplier * rewardMultiplier,
      isGrantedByAdmin: false,
    });
  });
  return pointsList;
};

export { modifyEra2Contributions, generateEra2Points, getMultiplier };
