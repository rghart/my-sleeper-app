import React from 'react';
import './App.css';
import './loader.css';
import PlayerInfoItem from './Components/PlayerInfoItem';
import LeaguePanel from './Panels/LeaguePanel';
import RanksPanel from './Panels/RanksPanel';
import firebase, { auth } from './firebase.js';
import createRankings from './helpers.js';
import URLS from './urls.js';
const { LATEST_UPDATE_ATTEMPT, ACTIVE_PLAYERS } = URLS;
var provider = new firebase.auth.GoogleAuthProvider();

class App extends React.Component {
  state = {
    playerInfo: {},
    leagueData: [],
    tradedDraftPicks: [],
    isLoading: true,
    loadingMessage: "Initial load...",
    rankingPlayersIdsList: [],
    filteredPlayersIdsList: [],
    isTyping: false,
    checkedItems: ["QB", "RB", "WR", "TE",],
    leagueID: "662349421429727232",
    rosterPositions: [],
    notFoundPlayers: [],
    lastUpdate: null,
    showTaken: false,
    showMyPlayers: true,
    showRookiesOnly: false,
    liveDraft: [],
    signedIn: false,
    signedInEmail: null,
  };

  componentDidMount() {
    auth.onAuthStateChanged((user) => {
      if (user) {
        const { playerInfo } = this.state;
        const { currentUser } = auth;
        this.setState({
            signedIn: !currentUser.isAnonymous,
            signedInEmail: currentUser.email ? currentUser.email : null,
        })
        if (playerInfo && Object.keys(playerInfo).length === 0) {
          this.getPlayerData();
        } else {
            this.getLeagueData();
        }
      } else {
        auth.signInAnonymously()
          .catch(err => console.error('Error:', err));
      }
    })
    
  }
  // TODO clean up and pull out helper functions and search function into separate file(s)
  checkErrors = (response) => {
    if (!response.ok) {
      throw new Error(response.statusText, response.status)
    }
    return response;
  }

  fetchRequest = async (url, type, data, custHeaders) => {
    const response = await fetch(url, { 
      method: type, 
      headers: custHeaders ? custHeaders : { 
        'Content-type': 'application/json'
      },
      body: data ? JSON.stringify(data) : null
    })
      .then(this.checkErrors)
      .catch(err => console.error('Error:', err));
    console.log(response.statusText);
    return response;
  }

  updatePlayerDB = async () => {
    // Attempt update to latest update attempt before calling Sleeper. return if that fails
    const updateResponse = await this.fetchRequest(LATEST_UPDATE_ATTEMPT + await auth.currentUser.getIdToken(true), 'PUT', new Date().getTime());
    if (updateResponse && updateResponse.ok) {
      const sleeperPlayerData = await fetch(`https://api.sleeper.app/v1/players/nfl`)
          .then(this.checkErrors)
          .then(response => response.json())
          .then(data => {
            console.log("Successfully fetched Sleeper Player data from API");
            let filteredData = {};
            filteredData.active_players = Object.fromEntries(
              Object.entries(data)
              .filter(([key, val]) => val.active)
            )
            const currentDate = new Date().getTime();
            filteredData.latest_update_attempt = currentDate;
            this.setState({
              lastUpdate: currentDate
            })
            return filteredData;
          })
          .catch((error) => {
              console.error('Error:', error);
            });
        const { latest_update_attempt: latestUpdateAttempt, active_players: activePlayers } = sleeperPlayerData;
        this.fetchRequest(LATEST_UPDATE_ATTEMPT + await auth.currentUser.getIdToken(true), 'PUT', latestUpdateAttempt);
        await this.fetchRequest(ACTIVE_PLAYERS + await auth.currentUser.getIdToken(true), 'PUT', activePlayers);
    } else {
      console.log("Wasn't able to update latest_update_attempt field")
    }
  }

  getLatestUpdateAttempt = async () => {
    return await fetch(LATEST_UPDATE_ATTEMPT + await auth.currentUser.getIdToken(true))
      .then(this.checkErrors)
      .then(response => response.json())
      .then(data => {
        this.setState({
          lastUpdate: data
        })
        return data;
      })
      .catch((error) => {
        console.error('Error:', error);
      });
  }

  getPlayerData = async () => {
    const day = 24 * 60 * 60 * 1000;
    const currentDate = new Date().getTime();
    const latestUpdateAttempt = await this.getLatestUpdateAttempt();
    if (currentDate - latestUpdateAttempt >= day) {
      await this.updatePlayerDB();
    }
    await fetch(ACTIVE_PLAYERS + await auth.currentUser.getIdToken(true))
      .then(response => response.json())
      .then(data => {
        this.setState({
          playerInfo: data,
        })
      })
      .catch((error) => {
        console.error('Error:', error);
      });
    this.getLeagueData();   
  }

  getLeagueData = () => {
    const leagueID = this.state.leagueID;
    const urls = [
      `https://api.sleeper.app/v1/league/${leagueID}/rosters`,
      `https://api.sleeper.app/v1/league/${leagueID}/users`,
      `https://api.sleeper.app/v1/league/${leagueID}`,
      `https://api.sleeper.app/v1/user/521035584588267520/leagues/nfl/2021`,
      `https://api.sleeper.app/v1/league/${leagueID}/drafts`,
    ]
    let requests = urls.map(async url => {
        const response = await fetch(url);
        return response.json();
    });
    Promise.all(requests)
      .then(data => {
        const leagueData = {};
        [
            leagueData.rosterData, 
            leagueData.managerData, 
            leagueData.currentLeague, 
            leagueData.leagueIds, 
            leagueData.currentLeagueDrafts,
        ] = data;
        this.markTakenPlayers(leagueData.rosterData, leagueData.managerData);
        this.setState({
          leagueData: leagueData,
          isLoading: false,
          loadingMessage: "Loading league panel...",
          rosterPositions: leagueData.currentLeague.roster_positions.filter(pos => pos !== "BN").map(pos => 
              { 
                  if (pos === "SUPER_FLEX") {
                      return "SFLX" 
                  } else if (pos === "FLEX") { 
                      return "FLX" 
                  } else { 
                    return pos 
                  } 
              }),
        });
        if (this.state.rankingPlayersIdsList) {
            this.filterPlayers();
        }
        this.getTradedDraftPicks();
      })
      .catch((error) => {
        console.error('Error:', error);
      });
  }

  getTradedDraftPicks = async () => {
      const draftId = this.state.leagueData.currentLeagueDrafts[0].draft_id;
      const tradedPicks = await fetch(`https://api.sleeper.app/v1/draft/${draftId}/traded_picks`)
        .then(response => response.json())
        .then(data => data)
        .catch((error) => {
          console.error('Error:', error);
      })
      this.setState({
        tradedDraftPicks: tradedPicks
      })
      this.getSpecificDraft();
  }

  getSpecificDraft = async () => {
    let { leagueData } = this.state;
    const draftId = leagueData.currentLeagueDrafts[0].draft_id;
    const draftData = await fetch(`https://api.sleeper.app/v1/draft/${draftId}`)
      .then(response => response.json())
      .then(data => data)
      .catch((error) => {
        console.error('Error:', error);
    })
    leagueData.currentDraft = draftData;
    this.setState({
      leagueData
    })
    if (draftData.draft_order) {
        this.buildDraft();
    } else {
        this.setState({
            loadingMessage: ""
        })
    }
  }

  markTakenPlayers = (rosterData, managerData) => {
    let playerObject = this.state.playerInfo;
    if (this.state.rankingPlayersIdsList) {
        for (let i = 0; i < Object.keys(playerObject).length + 1; i++) {
            if (playerObject[i]) {
                playerObject[i].is_taken = false;
                playerObject[i].rostered_by = null;
            }
        }
    }
    for (let i = 0; i < rosterData.length; i++) {
      const currentManagerId = rosterData[i].owner_id;
      const currentManagerData = managerData.find(manager => manager.user_id === currentManagerId);
      rosterData[i].manager_display_name = currentManagerData ? currentManagerData.display_name : "Unassigned";
      rosterData[i].avatar = currentManagerData ? currentManagerData.avatar : null;
      rosterData[i].players.forEach(player => {
        playerObject[player].is_taken = true;
        playerObject[player].rostered_by = rosterData[i].manager_display_name;
      })
    }
    this.setState({
      playerInfo: playerObject
    })
  }

    updateParentState = (state, value, callback, loadingMessage) => {
        this.setState({
          [state]: value,
          loadingMessage
        }, this[callback])
    }

    handleChange = (e) => {
      const item = e.target.name;
      const index = this.state.checkedItems.indexOf(item);
      const checkedItems = this.state.checkedItems;
      index !== -1 ? checkedItems.splice(index, 1) : checkedItems.push(item);
      this.setState({
          checkedItems: checkedItems
      });
      this.filterPlayers();
    }

    startLoad = (loadMessage, searchText) => {
        this.setState({
          loadingMessage: loadMessage
        }, () =>  setTimeout(() => this.updateRankings(searchText)),
        0)
    }

    updateRankings = (searchText) => {
        const { playerInfo } = this.state;
        const [searchResultsArray, notFoundPlayers] = createRankings(searchText, playerInfo);

        this.setState({
          rankingPlayersIdsList: searchResultsArray,
          isLoading: false,
          loadingMessage: "",
          notFoundPlayers: notFoundPlayers,
          searchText: ""
        }, this.filterPlayers)
    }

    filterPlayers = (rankingPlayers) => {
        const { showTaken, showMyPlayers, showRookiesOnly, playerInfo, rankingPlayersIdsList } = this.state;
        let playerList = rankingPlayers ? rankingPlayers : rankingPlayersIdsList;
        
        if (!showTaken && showMyPlayers) {
            playerList = playerList.filter(results => !playerInfo[results.match_results[0]].is_taken || playerInfo[results.match_results[0]].rostered_by === 'ryangh')
        } else if (!showTaken) {
            playerList = playerList.filter(results => !playerInfo[results.match_results[0]].is_taken)
        } else if (showTaken && !showMyPlayers) {
            playerList = playerList.filter(results =>  playerInfo[results.match_results[0]].rostered_by !== 'ryangh')
        }  else if (!showMyPlayers) {
            playerList = playerList.filter(results =>  playerInfo[results.match_results[0]].rostered_by !== 'ryangh' || playerInfo[results.match_results[0]].rostered_by)
        }

        if (showRookiesOnly) {
            playerList = playerList.filter(results => playerInfo[results.match_results[0]].years_exp < 1)
        }
        
        this.setState({
            filteredPlayersIdsList: playerList.filter(results => this.state.checkedItems.includes(playerInfo[results.match_results[0]].position))
        })
    }

    updatePlayerId = (newRankingPlayersIdsList) => {
        this.filterPlayers(newRankingPlayersIdsList);
    }

    addToRoster = (playerInfo) => {
        let { rosterPositions } = this.state;
        if (playerInfo.position === "TE" || playerInfo.position === "RB" || playerInfo.position === "WR") {
            playerInfo.fantasy_positions.push("FLX");
            playerInfo.fantasy_positions.push("SFLX");
        } else if (playerInfo.position === "QB") {
            playerInfo.fantasy_positions.push("SFLX");
        }

        for (let i = 0; i < playerInfo.fantasy_positions.length; i++) {
            const includesPosition = rosterPositions.includes(playerInfo.fantasy_positions[i]);
            if (includesPosition) {
                const positionIndex = rosterPositions.indexOf(playerInfo.fantasy_positions[i]);
                let position = ["SFLX", "FLX"].includes(playerInfo.fantasy_positions[i]) ? `${playerInfo.fantasy_positions[i]} / ${playerInfo.position}` : playerInfo.fantasy_positions[i];
                rosterPositions.splice(positionIndex, 1, `${position} ${playerInfo.full_name} ${playerInfo.team ? playerInfo.team : ""}`);
                break;
            }
        }
         this.setState({
             rosterPositions: rosterPositions
         })
    }

    buildDraft = () => {
        const { leagueData, tradedDraftPicks } = this.state;
        const { currentDraft } = leagueData;
        const { settings } = currentDraft;
        let draftType = "";
        switch (settings.player_type) {
            case 1:
                draftType = "Rookie";
                break;
            case 2:
                draftType = "Veteran";
                break;
            default:
                draftType = "All players"
                break;
        }
        const createPickOrder = (round) => {
            let pickOrder = [];
            for (const [key, value] of Object.entries(currentDraft.draft_order)) {
                let obj = {
                  pick_number: value,
                  user_id: key,
                  roster_id: currentDraft.slot_to_roster_id[value],
                  is_traded: false,
                  owner_id: currentDraft.slot_to_roster_id[value],
                  pick_round: round,
                  pick_spot_string: `${round}.${value}`,
                  player_id: null
                }
                pickOrder.push(obj)
            };
            return pickOrder.sort((a, b) => a.pick_number - b.pick_number);
        }

        let draftRounds = [];
        for (let i = 0; i < settings.rounds; i++) {
            let round = {};
            round.round = settings.rounds - i;       
            round.picks = createPickOrder(round.round);
            draftRounds.unshift(round);
        }
        tradedDraftPicks.forEach(tradedPick => {
            let draftRoundIndex = draftRounds[tradedPick.round - 1].picks.findIndex(pick => pick.roster_id === tradedPick.roster_id);
            Object.assign(draftRounds[tradedPick.round - 1].picks[draftRoundIndex], {
                owner_id: tradedPick.owner_id, 
                is_traded: true
            })
        })
        leagueData.currentDraft.built_draft = draftRounds;
        leagueData.currentDraft.player_pool = draftType;
        this.setState({
            leagueData,
            loadingMessage: ""
        })
    }

    googleSignIn = () => {
        firebase.auth()
          .signInWithPopup(provider)
          .catch((error) => {
              console.log(error);
          });
    }

    signOut = () => {
        firebase.auth().signOut().then(() => {
          this.setState({
              filteredPlayersIdsList: [],
              rankingPlayersIdsList: []
          })
          console.log("Sign-out successful.");
        }).catch((error) => {
          // An error happened.
        });
    }

  render() {
      const { 
          playerInfo, 
          isLoading, 
          lastUpdate,
          loadingMessage, 
          showTaken,
          showMyPlayers,
          showRookiesOnly,
          filteredPlayersIdsList,
          checkedItems, 
          rankingPlayersIdsList, 
          rosterPositions, 
          leagueData, 
          notFoundPlayers,
          leagueID,
          signedIn,
          signedInEmail,
      } = this.state;
      if (isLoading && loadingMessage === "Initial load...") {
        return <div className="loader"></div>;
      } else {
          return (
            <div>
                <div style={{display: "flex", flexDirection: "row", justifyContent: "space-between", padding: `${0}px ${3}px`}}> 
                    <p className="latest-update"><i>Latest player DB update attempt: {new Date(lastUpdate).toString()}</i></p>
                    { signedIn ?
                        <div style={{display: "flex", flexDirection: "row", alignItems: "baseline"}}>
                            <p className="latest-update"><i>{signedInEmail}</i></p>
                            <button className="button sign-in-button" onClick={this.signOut}>Sign out</button>
                        </div> :
                        <button className="button sign-in-button" onClick={this.googleSignIn}>Sign in</button>
                    }
                </div>
                <h1 className="title">Sleeper Team Assistant</h1>
                <div className="main-container">
                    <RanksPanel 
                        loadingMessage={loadingMessage}
                        signedIn={signedIn}
                        handleChange={this.handleChange}
                        checkedItems={checkedItems}
                        updateFilter={this.updateParentState}
                        showMyPlayers={showMyPlayers}
                        showRookiesOnly={showRookiesOnly}
                        showTaken={showTaken}
                        startLoad={this.startLoad}
                        fetchRequest={this.fetchRequest}
                        checkErrors={this.checkErrors}
                        rankingPlayersIdsList={rankingPlayersIdsList}
                    >
                        {filteredPlayersIdsList.map(results => (
                            <PlayerInfoItem 
                                key={`${results.match_results[0]}${results.ranking}`} 
                                player={playerInfo[results.match_results[0]]}
                                playerInfo={playerInfo}
                                addToRoster={this.addToRoster} 
                                updatePlayerId={this.updatePlayerId}
                                rankingPlayersIdsList={rankingPlayersIdsList}
                            />
                        ))}
                        {notFoundPlayers.map((item, index) => (
                          <p key={item + new Date().getTime() + index}>{item}</p>
                        ))}
                    </RanksPanel>
                    <LeaguePanel 
                        leagueData={leagueData} 
                        leagueID={leagueID} 
                        updateParentState={this.updateParentState} 
                        rosterPositions={rosterPositions}
                        playerInfo={playerInfo}
                        loadingMessage={loadingMessage}
                    />
                </div>
            </div>
        )};
    }
}

export default App;
