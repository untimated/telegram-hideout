# Brief

this is an effort to make my telegram group "Gossip Boy" mini app
more useful, interesting and had something going on. It's been quite silent lately
so i think, making extended tangible world even small.

# Goal

The Name "Hideout" is less antagonistic and more of relaxed one.
It's a series of small maps stiched together, built like an first person rpg,
but with mechanics similar to the sims. there will be plenty of mechanics that will be integrated with realtime web data.

# Core Features

## Roaming
Simple First person roaming around, you'll be able to see other players using
client-server websocket. 

## Interaction
Some objects and all players are interactable (point click) 
and will show HTML UI.
- on buy food : 
     - order food -> food have different 3D model, serve it on static location like certain spot (like table)
     - use food  -> this is when player consume the food by first interacting with it
                   other player can eat it, basically a drop item
- on buy drink (same as food): 
     - order drink -> drink have different 3D model, serve it on static location like certain bar spot
     - use drink   -> this is when player consume the drink by first interacting with it
                   other player can drink it, basically a drop item

- on using Jukebox 
    - order song   -> pick from list , spend coin for each
    - play song    -> notify other players to play the same
    just like drop item, any player can just go to the box and turn off your music, coin is already paid


## NPCS
Will be static, have schedule for each.
No path finding needed, just let them appear on their designated place... 
or ocasionally give them static round patrol movement

- Plain Joe 
  Time     : 11AM-3PM & 5PM to 7PM
  Position : at Table 2
  Activity : Lunch (just sitting for now) & Dinner
- Nicholas came at 
  Time     : 5AM-9PM
  Position : By Jukebox
  Activity : dancing
- Yan 
  Time     : 9AM-1PM
  Position : By the window
  Activity : staring at the pool 
- Samantha, Stanley the organist and Harvey the percussionist 
  Time     : 5PM-11PM
  Position : Stage
  Activity : Playing At the stage
- Wolfred the bartender
  Time     : 9am to 12pm
  Position : Bar
  Activity : initiate buy drink UI (cannot buy if he's present)
- Pierre the Cook
  Time     : 8am to 8pm
  Position : Kitchen Counter
  Activity : initiate food (cannot buy it he's not present)
- ...


# Economy
Player is given 100 coin per day to spend, value will carry over if saved 
persist it in local storage if possible, but if mini app (telegram webvie) can't, just limit per session

## Trading

    we can provide transfer coin as well for our poor friends

    open modal: 
    ------------------

      Cash [inhand] 
      Amount [value]
        Transfer | Cancel
    ------------------

## Goods
I'll provide the icon later, use default first
Bar Menu (interact with Wolfred) :
- Pint of Beer - 20 coin  (drunk + 0.2, fuel -0.1)
- Highball     - 30 coin  (drunk + 0.2, fuel -0.2)
- Mojito       - 40 coin  (drunk + 0.1, fuel  -0.05)
- Sherry       - 50 coin  (drunk + 0.2, fuel -0.2)
- **Saturday's Special**       - 50 coin (drunk +1.0, fuel -1.0)   -- only shows on saturday
- **Wednesdays's Special**       - 50 coin (drunk +1.0, fuel -1.0)   -- only shows on saturday
for Special menu, put a poster that can be interaceted and popped out a modal

Food Menu (buffer counter interaction) :
- English Breakfast             - 20 coin  (drunk -0.2, fuel +0.2)
- Uncle's Fried Rice            - 30 Coin  (drunk -0.3, fuel +0.3)
- Pierre's Smash Burger         - 15 coin  (durnk -0.2, fuel +0.3)
- **Saturday's Challenge**     - 50 coin (drunk -1.0, fuel +1.0)   -- only shows on saturday
- **Thursday's Challenge**     - 50 coin (drunk -1.0, fuel +1.0)   -- only shows on saturday
for Special menu, put a poster that can be interaceted and popped out a modal

Complementary Menu (Fountain area) :
- Chocolate Fondue  - 10 coin
- Orange Juice      - 5 coin
- Apple Juice       - 5 coin

Jukebox : 
- Determined Vaporwave By Catch22Music  - 10 coin
- Exploring Vaporwave By Catch22Music   - 10 coin:w
 
News Stand :
- pick weird news like discovery channel, natgeo, popular science, or some weird sub culture
- if possible render it in a news paper like background, and use new paper like formatting(css)
- I saw readers digest got wide variety of casual news, maybe if they got rss we can pull and transform the news.
- hardcoded/handpicked content also works, we dont need any parser to pull off from rss, but must be decided how we updated the content.

Band:
unlike Jukebox, we cannot see what is being played, we just pay the stage 15 coin for them to sing one music (check assets/band/)
- one full song per payment, at default volume; cannot stop or restart until the song finishes

Arcade:
   Slots :
      - cost : min 7 coin, up to unlimited
      - win rate : 20% for two symbol, 10% for three symbol, and 5% for jackpot
      - payout :
          + 2 same symbol (except jackpot) + 1 = 3x Base
          + 3 same symbol (except jackpot)     = 6x Base
          + Jackpot                            = 12x Base
      - for every lost, subtract fuel by -2


Leaderboard
- Top Spender
    Simple accumulate over time, no weekly or monthly thing
    guest can be registered just fine, no correctness enforced here, just overriden over an over
  - Top Visits
    record user visits (daily), multi relog in-a-day shouldn't counted
  - Drunkest
    no need for now, just empty


# Mood / State
Consuming something, or doing something induces effects scale from 0 to 1
for now we just do two things
- Drunk   (start from 0)
  on drunk > 0.5, do blurry post process (blurrines = map_value(drunk, 0.0, 1.0))
  on drunk == 1, do sleep pose, cannot move from the floor
  every hour active (exact at 1,2,3..) -> reduce drunk by -0.3 (free heal)
  (if has_not_login_today && now > 1am) -> restore drunk to 0
- Fuel  (start from 1)
  on energy == 0.0 -> do sleep pose, cannot move from the floor
  every hour active (exact at 1,2,3..) -> reduce energy by 0.1 
  (if has_not_login_today && now > 1am) -> restore energy to 1.0

# Backlog

- [x] **Spatial 3D sound for music** — Use the browser Web Audio API / Three.js
  `PositionalAudio` for the jukebox and live band. Place sound sources at the jukebox
  and stage, with the listener following the camera's position and orientation.
  Add directional sound and distance falloff while preserving shared playback timing,
  reconnect seeking, the band's payment/playback lock, mute, and existing volume controls.
  Keep regular audio playback as a fallback if spatial audio is unavailable.
