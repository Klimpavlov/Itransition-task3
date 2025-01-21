const crypto = require('node:crypto');
const readline = require('readline');
const AsciiTable = require('ascii-table');


const generateSecureKey = () => crypto.randomBytes(32).toString('hex');

const generateRandomNumber = (max) => {
    const randomBuffer = crypto.randomBytes(4);
    const randomNumber = randomBuffer.readUint32BE(0);
    return randomNumber % max
}

const calculateHMAC = (key, message) =>
    crypto.createHmac('sha256', key).update(message.toString()).digest('hex');

// generate probability Table
const generateProbabilityTable = (diceConfigs) => {
    const table = new AsciiTable('Probability of Win for the User');
    const headers = ['User dice v', ...diceConfigs.map(config => `${config.join(',')}`)];
    table.setHeading(...headers);

    diceConfigs.forEach((userDice, userIndex) => {
        const row = diceConfigs.map((computerDice, computerIndex) => {
            if (userIndex === computerIndex) return `- (0.3333)`;
            const winProbability = calculateWinProbability(userDice, computerDice);
            return winProbability.toFixed(4);
        });
        table.addRow(`${userDice.join(',')}`, ...row);
    });

    return table.toString();
};

// calculate win probability
const calculateWinProbability = (userDice, computerDice) => {
    let userWins = 0;
    const totalThrows = 36;

    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
            const userThrow = userDice[i];
            const computerThrow = computerDice[j];
            if (userThrow > computerThrow) userWins++;
        }
    }

    return userWins / totalThrows;
};

const printHelp = () => {
    console.log(`
Dice Game Rules:
1. Players (computer and user) choose dice configurations.
2. Each dice has 6 sides with custom values.
3. The winner is determined by the higher throw.
4. HMAC ensures fairness.

Options:
  0 - Choose option 0
  1 - Choose option 1
  X - Exit
  ? - Help
`);
};

// dice logic

const playGame = (diceConfigs) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const askUserInput = (question, callback) => {
        rl.question(question, (input) => callback(input.trim()));
    };

    // determining the first move

    const determineFirstMove = () => {
        const key = generateSecureKey();
        const computerChoice = generateRandomNumber(2);
        const hmac = calculateHMAC(key, computerChoice);
        console.log(`I selected a random value in the range 0..1 (HMAC=${hmac}).`);
        return {key, computerChoice, hmac};
    }

    // Player selection processing function
    const handleDiceSelection = (computerDiceIndex, callback) => {
        console.log(`I make the first move and choose the [${diceConfigs[computerDiceIndex].join(',')}].`);
        console.log('Choose your dice:');
        diceConfigs.forEach((config, index) => {
            if (index !== computerDiceIndex) {
                console.log(`${index} - [${config.join(',')}]`);
            }
        });
        console.log('X - Exit');
        console.log('? - Help');

        askUserInput('Your selection: ', (userInput) => {
            if (userInput === 'X') {
                console.log('Goodbye!');
                rl.close();
                return;
            }

            if (userInput === '?') {
                printHelp();
                handleDiceSelection(computerDiceIndex, callback);
                return;
            }

            const userDiceIndex = parseInt(userInput, 10);

            if (
                isNaN(userDiceIndex) ||
                userDiceIndex < 0 ||
                userDiceIndex >= diceConfigs.length ||
                userDiceIndex === computerDiceIndex
            ) {
                console.log('Invalid selection. Try again.');
                handleDiceSelection(computerDiceIndex, callback);
                return;
            }

            console.log(`You chose the [${diceConfigs[userDiceIndex].join(',')}].`);
            callback(userDiceIndex);
        });
    };

    // Throw dice
    const performThrow = (dice, callback) => {
        const key = generateSecureKey();
        const randomValue = generateRandomNumber(6);
        const hmac = calculateHMAC(key, randomValue);

        console.log(`I selected a random value in the range 0..5 (HMAC=${hmac}).`);
        console.log('Add your number modulo 6:');
        [...Array(6).keys()].forEach((i) => console.log(`${i} - ${i}`));
        console.log('X - Exit');
        console.log('? - Help');

        askUserInput('Your selection: ', (userInput) => {
            if (userInput === 'X') {
                console.log('Goodbye!');
                rl.close();
                return;
            }

            if (userInput === '?') {
                printHelp();
                performThrow(dice, callback);
                return;
            }

            const userModValue = parseInt(userInput, 10);

            if (isNaN(userModValue) || userModValue < 0 || userModValue >= 6) {
                console.log('Invalid input. Try again.');
                performThrow(dice, callback);
                return;
            }

            console.log(`My number is ${randomValue} (KEY=${key}).`);
            const result = (randomValue + userModValue) % 6;
            console.log(`The result is ${randomValue} + ${userModValue} = ${result} (mod 6).`);
            const throwValue = dice[result];
            console.log(`The throw result is ${throwValue}.`);
            callback(throwValue);
        });
    };

    // The main process of the game
    const startGame = () => {

        console.log('\n' + generateProbabilityTable(diceConfigs));

        const {key, computerChoice, hmac} = determineFirstMove();

        askUserInput('Try to guess my selection (0 or 1): ', (userInput) => {
            if (userInput === 'X') {
                console.log('Goodbye!');
                rl.close();
                return;
            }

            if (userInput === '?') {
                printHelp();
                startGame();
                return;
            }

            const userGuess = parseInt(userInput, 10);

            if (isNaN(userGuess) || userGuess < 0 || userGuess > 1) {
                console.log('Invalid input. Please enter 0 or 1.');
                startGame();
                return;
            }

            console.log(`My selection: ${computerChoice} (KEY=${key}).`);
            const computerDiceIndex = userGuess === computerChoice ? 1 : 0;
            handleDiceSelection(computerDiceIndex, (userDiceIndex) => {
                console.log("It's time for my throw.");
                performThrow(diceConfigs[computerDiceIndex], (computerThrow) => {
                    console.log("It's time for your throw.");
                    performThrow(diceConfigs[userDiceIndex], (userThrow) => {
                        if (userThrow > computerThrow) {
                            console.log(`You win (${userThrow} > ${computerThrow})!`);
                        } else if (userThrow < computerThrow) {
                            console.log(`I win (${computerThrow} > ${userThrow})!`);
                        } else {
                            console.log(`It's a tie (${userThrow} = ${computerThrow})!`);
                        }
                        rl.close();
                    });
                });
            });
        });
    };

    startGame();


}

const main = () => {
    try {
        const args = process.argv.slice(2);
        if (args.length < 3) {
            throw new Error(
                'You must provide at least 3 dice configurations as arguments. Example: 2,2,4,4,9,9 6,8,1,1,8,6 7,5,3,7,5,3'
            );
        }

        const diceConfigs = args.map((arg) => {
            const sides = arg.split(',').map(Number);
            if (sides.length !== 6 ||
                sides.some((side) => isNaN(side) || !Number.isInteger(side))) {
                throw new Error(
                    `Invalid dice configuration: ${arg}. Each dice must have exactly 6 integer sides.`
                );
            }
            return sides;
        });
        playGame(diceConfigs);
    } catch (error) {
        console.error(error.message);
        console.log('Example: node task-3.js 2,2,4,4,9,9 6,8,1,1,8,6 7,5,3,7,5,3');
    }
}

main();






