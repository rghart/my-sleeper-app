import Fuse from 'fuse.js';

const getHighestScore = (arr, fuseSearch) => {
    let bestResult = arr
        .map((item) => fuseSearch.search(item.replace(/[^a-zA-Z]/g, '')))
        .filter((item) => item.length > 0)
        .sort((a, b) => a[0]?.score - b[0]?.score);
    return bestResult[0] && bestResult[0][0].score === 0 ? bestResult[0][0].item : null;
};

const createRankings = (searchText, playerInfo) => {
    const playerInfoArray = Object.values(playerInfo);
    playerInfoArray.sort((a, b) => a.search_rank - b.search_rank);
    const playerInfoFuseOptions = {
        useExtendedSearch: true,
        includeScore: true,
        keys: ['search_last_name', 'search_first_name', 'team', 'position'],
    };
    const options = {
        includeScore: true,
    };
    const positions = ['QB', 'RB', 'WR', 'TE', 'DEF', 'K'];
    const teams = [
        'CAR',
        'MIN',
        'TEN',
        'GB',
        'NO',
        'NYG',
        'KC',
        'IND',
        'LAC',
        'DAL',
        'BUF',
        'CLE',
        'SEA',
        'ARI',
        'LV',
        'ATL',
        'LAR',
        'LA',
        'FA',
        'CIN',
        'SF',
        'JAX',
        'JAC',
        'WAS',
        'CHI',
        'PHI',
        'BAL',
        'TB',
        'DEN',
        'HOU',
        'PIT',
        'MIA',
        'DET',
        'NE',
        'NYJ',
        'ROOKIE',
    ];
    const playerInfoIndex = Fuse.createIndex(playerInfoFuseOptions.keys, playerInfoArray);
    const playerInfoFuse = new Fuse(playerInfoArray, playerInfoFuseOptions, playerInfoIndex);
    const teamsFuse = new Fuse(teams, options);

    let addLineBreak = searchText.replace(/(?:\r\n|\r|\n)/g, '<br>');
    let splitLineBreak = addLineBreak.split('<br>');
    let searchResultsArray = [];
    let ranking = 1;
    let notFoundPlayers = [];

    splitLineBreak.forEach((line) => {
        // Removing any numbers from the search string
        line = line.replace(/[0-9]/g, '');
        if (!line.trim()) {
            return;
        }
        // Splitting the string
        let splitString = line.split('');
        // Making sure the first index isn't a period after removing numbers. Just in case we get "1., 2., 3."" etc
        if (splitString[0] === '.') {
            splitString.splice(0, 1, '');
        }
        // Sometimes ranks just have the first letter of the first name and the last name separated by a period. ex. "T.Brady"
        // Want to remove this without removing for players that go by initials, ex. "J.K. Dobbins"
        if (splitString[1] === '.' && splitString[3] !== '.') {
            splitString.splice(1, 1, ' ');
        } else if (splitString[1] === '.' && splitString[3] === '.' && splitString[4] !== ' ') {
            splitString.splice(3, 1, '. ');
        }
        const lettersOnly = splitString.map((string) => string.replace(/[^a-zA-Z\s]/g, ''));
        if (!lettersOnly.join('').trim()) {
            return;
        }
        console.log(lettersOnly);
        let nameAndTeam = lettersOnly.join('').trim();
        // Splitting by spaces and removing whitespace
        let firstLastTeamArrays = nameAndTeam.split(/\s/).map((item) => item.trim());
        let searchArray = [];
        let foundPositionStr;
        let foundTeamStr;
        // If there's more than 2 indexes, we want to see if they can help with our search by looking for player position and team initials
        if (firstLastTeamArrays.length > 2) {
            const positionIndex = firstLastTeamArrays.findIndex((item, index) => positions.includes(item) && index > 1);
            if (positionIndex >= 0) {
                foundPositionStr = firstLastTeamArrays.splice(positionIndex, 1)[0];
                searchArray.unshift(foundPositionStr);
            }
            foundTeamStr = getHighestScore(firstLastTeamArrays, teamsFuse);
            if (foundTeamStr) {
                firstLastTeamArrays.splice(firstLastTeamArrays.indexOf(foundTeamStr), 1);
                searchArray.unshift(foundTeamStr);
            }
        }

        searchArray.unshift(firstLastTeamArrays[0], firstLastTeamArrays[1]);
        console.log(searchArray);

        let results = playerInfoFuse.search({
            $or: [
                {
                    $and: [
                        { search_last_name: searchArray[1] },
                        {
                            $or: [{ search_first_name: searchArray[0] }, { search_first_name: `^${searchArray[0]}` }],
                        },
                        { position: `=${searchArray[3]}` },
                        { team: `=${searchArray[2]}` },
                    ],
                },
                // eslint-disable-next-line
          {
                    $and: [
                        { search_last_name: searchArray[1] },
                        {
                            $or: [{ search_first_name: searchArray[0] }, { search_first_name: `^${searchArray[0]}` }],
                        },
                        { position: `=${searchArray[3]}` },
                    ],
                },
                // eslint-disable-next-line
          {
                    $and: [
                        { search_last_name: searchArray[1] },
                        {
                            $or: [{ search_first_name: searchArray[0] }, { search_first_name: `^${searchArray[0]}` }],
                        },
                        { team: `=${searchArray[2]}` },
                    ],
                },
                // eslint-disable-next-line
          {
                    $and: [
                        { search_last_name: searchArray[1] },
                        {
                            $or: [{ search_first_name: searchArray[0] }, { search_first_name: `^${searchArray[0]}` }],
                        },
                    ],
                },
            ],
        });
        let fResults = results
            .filter((result) => positions.includes(result.item.position))
            .map((result) => [result.item.player_id, result.score.toFixed(3)]);
        if (fResults[0]) {
            if (fResults.length > 5) {
                fResults = fResults.filter((result) => fResults.indexOf(result) <= 4);
            }
            searchResultsArray.push({
                match_results: fResults,
                ranking: ranking,
                search_string: searchArray.join(' '),
            });
            if (results[0].item.search_rank > 1000) {
                console.log(
                    `${results[0].item.full_name} ${results[0].item.position} ${results[0].item.team} Rank: ${ranking}`,
                );
            }
        } else {
            notFoundPlayers.push(
                `Couldn't find ${firstLastTeamArrays[0]} ${firstLastTeamArrays[1]} ${foundTeamStr}  ${foundPositionStr} Rank: ${ranking}`,
            );
        }
        ranking += 1;
    });

    return [searchResultsArray, notFoundPlayers];
};

export default createRankings;
