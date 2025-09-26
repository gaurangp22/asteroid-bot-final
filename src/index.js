import 'dotenv/config';
import { Telegraf, Markup } from 'telegraf';
import { AsterAPI } from './asterdex.js';
import { BNBWallet } from './bnb-wallet.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// const MAIN_WALLET_ADDRESS = process.env.MAIN_WALLET_ADDRESS;
// const API_WALLET_ADDRESS = process.env.API_WALLET_ADDRESS;
// const API_WALLET_PRIVATE_KEY = process.env.API_WALLET_PRIVATE_KEY;
const ASTER_API_KEY = process.env.ASTER_API_KEY;
const ASTER_API_SECRET = process.env.ASTER_API_SECRET;

if (!BOT_TOKEN  || !ASTER_API_KEY || !ASTER_API_SECRET) {
  console.error('Missing required environment variables in .env');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const asterAPI = new AsterAPI( ASTER_API_KEY, ASTER_API_SECRET);
const bnbWallet = new BNBWallet();

// User session storage
const userSessions = new Map();

// Start command - Initialize account
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  
  try {
    // Get wallet address from BNB wallet
    const walletAddress = bnbWallet.getAddress();
    
    // Initialize user session
    userSessions.set(userId, {
      walletAddress: walletAddress,
      isInitialized: true,
      tradingFlow: null
    });

    const welcomeMessage = `
🚀 **Welcome to AsterDex BNB Trading Bot!**

I'll help you trade BNB pairs on AsterDex through Telegram.

**Your Account:**
✅ Account initialized successfully
✅ Wallet address: \`${walletAddress}\`
✅ Ready for trading

**Getting Started:**
1. Use /balance to check your BNB balance
2. Use /deposit to fund your trading account
3. Use /markets to see available BNB pairs
4. Use /long or /short to start trading

**Available Commands:**
/help - Show all commands
/balance - Check balances
/deposit - Deposit BNB
/long - Open long position
/short - Open short position
/close - Close positions
/positions - View positions
/price - Get market prices
/markets - Available markets

Ready to trade? Let's go! 🎯
    `;

    await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    await ctx.reply(`❌ Account initialization failed: ${error.message}`);
  }
});

// Help command
bot.help(async (ctx) => {
  const helpText = `
📋 **Available Commands:**

**Wallet & Balance:**
/balance - Check BNB and trading balances
/transfer [amount] [asset] - Transfer from wallet to futures
/export - Export wallet keys

**Trading:**
/long - Open long position (interactive)
/short - Open short position (interactive)
/close - Close existing positions
/positions [symbol] - View your positions

**Market Info:**
/price [symbol] - Get current prices
/markets - List all available BNB pairs

**Examples:**
/price BNB
/positions BTC
/deposit 0.1
  `;

  await ctx.reply(helpText, { parse_mode: 'Markdown' });
});

// Balance command
bot.command('balance', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const session = userSessions.get(userId);
    
    if (!session?.isInitialized) {
      return ctx.reply('Please use /start first to initialize your account.');
    }

    // Get BNB balance from wallet
    const bnbBalance = await bnbWallet.getBalance();
    
    // Get trading account balance from AsterDex
    const tradingBalance = await asterAPI.getAccountBalance();
    
    // Get spot account balance
    let spotBalance = 'Unable to fetch';
    try {
      const spotResponse = await asterAPI.getSpotAccountBalance();
      spotBalance = spotResponse.USDT || '0';
    } catch (error) {
      console.log('Could not fetch spot balance:', error.message);
    }
    
    const balanceMessage = `
💰 **Your Balances:**

**BNB Wallet:** ${bnbBalance} BNB
**AsterDex API Wallet:** 0x609b0bb89cf23b7b3f4b643808e61f7454f4d8e4
**Spot Account:** ${spotBalance} USDT
**Futures Account:** ${tradingBalance.available} USDT
**Total Margin:** ${tradingBalance.total} USDT

💡 Use /transfer to move USDT from spot to futures
    `;

    await ctx.reply(balanceMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    await ctx.reply(`❌ Unable to fetch balance: ${error.message}`);
  }
});

// Transfer command - Transfer from spot to futures using v3 API
bot.command('transfer', async (ctx) => {
  try {
    const args = ctx.message.text.split(' ');
    const amount = args[1];
    const asset = args[2] || 'USDT';
    
    if (!amount) {
      return ctx.reply('Usage: /transfer [amount] [asset]\nExample: /transfer 25 USDT');
    }

    const userId = ctx.from.id;
    const session = userSessions.get(userId);
    
    if (!session?.isInitialized) {
      return ctx.reply('Please use /start first to initialize your account.');
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return ctx.reply('Invalid amount. Please enter a valid number.');
    }

    // Transfer from spot to futures using v3 API
    const result = await asterAPI.transferSpotToFutures(asset, transferAmount);
    
    const transferMessage = `
✅ **Transfer Successful!**

**Asset:** ${asset}
**Amount:** ${transferAmount}
**Transaction ID:** ${result.transactionId}
**Status:** ${result.status}

Your funds are now available in your futures account for trading.
    `;

    await ctx.reply(transferMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    await ctx.reply(`❌ Transfer failed: ${error.message}`);
  }
});


// Markets command
// bot.command('markets', async (ctx) => {
//   try {
//     const markets = await asterAPI.getMarkets();
    
//     let marketList = '📈 **Available BNB Markets:**\n\n';
    
//     markets.forEach(market => {
//       marketList += `**${market.symbol}** - Max Leverage: ${market.maxLeverage}x\n`;
//     });
    
//     marketList += `\nTotal: ${markets.length} BNB pairs available`;
    
//     await ctx.reply(marketList, { parse_mode: 'Markdown' });
//   } catch (error) {
//     await ctx.reply(`❌ Unable to fetch markets: ${error.message}`);
//   }
// });

// Debug command to see all symbols
// src/index.js

// Markets command
// Markets command
bot.command('markets', async (ctx) => {
  try {
    const markets = await asterAPI.getMarkets(); // This is now a simple array
    
    const marketList = markets
        .slice(0, 20) // Show the first 20 markets
        .map(market => `**${market.symbol}**`)
        .join('\n');

    const marketMessage = `📈 **Available Crypto Markets (${markets.length} pairs):**\n\n${marketList}\n\n...and more.`;
    
    await ctx.reply(marketMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    await ctx.reply(`❌ Unable to fetch markets: ${error.message}`);
  }
});

// Price command
bot.command('price', async (ctx) => {
  try {
    const args = ctx.message.text.split(' ');
    const symbol = args[1] || 'BNB';
    
    const price = await asterAPI.getPrice(symbol);
    
    const priceMessage = `
📊 **${symbol} Price:**

**Current:** $${price.price}
**24h Change:** ${price.change24h}%
**24h High:** $${price.high24h}
**24h Low:** $${price.low24h}
**Volume:** $${price.volume24h}
    `;
    
    await ctx.reply(priceMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    await ctx.reply(`❌ Unable to fetch price: ${error.message}`);
  }
});

// Long position command
const startTradingFlow = async (ctx, tradeType) => {
  const userId = ctx.from.id;
  const session = userSessions.get(userId);
  if (!session?.isInitialized) {
      return ctx.reply('Please use /start first to initialize your account.');
  }

  session.tradingFlow = { type: tradeType, step: 'select_asset' };
  userSessions.set(userId, session);

  const markets = await asterAPI.getMarkets();
  const keyboard = markets.slice(0, 10).map(market =>
      [Markup.button.callback(market.symbol, `select_asset_${market.symbol}`)]
  );
  
  const message = tradeType === 'long' 
      ? '📈 **Open Long Position**\n\nSelect the asset you want to trade:' 
      : '📉 **Open Short Position**\n\nSelect the asset you want to trade:';

  await ctx.reply(message, Markup.inlineKeyboard(keyboard));
};

bot.command('long', (ctx) => startTradingFlow(ctx, 'long'));
bot.command('short', (ctx) => startTradingFlow(ctx, 'short'));

// Positions command
bot.command('positions', async (ctx) => {
  try {
    const args = ctx.message.text.split(' ');
    const symbol = args[1];
    
    const positions = await asterAPI.getPositions(symbol);
    
    if (positions.length === 0) {
      return ctx.reply('No open positions found.');
    }
    
    let positionsList = '📊 **Your Positions:**\n\n';
    
    positions.forEach(pos => {
      const pnl = pos.unrealizedPnl >= 0 ? `+$${pos.unrealizedPnl}` : `-$${Math.abs(pos.unrealizedPnl)}`;
      const pnlEmoji = pos.unrealizedPnl >= 0 ? '🟢' : '🔴';
      
      positionsList += `${pnlEmoji} **${pos.symbol}**\n`;
      positionsList += `Size: ${pos.size} | Leverage: ${pos.leverage}x\n`;
      positionsList += `Entry: $${pos.entryPrice} | Current: $${pos.markPrice}\n`;
      positionsList += `PnL: ${pnl}\n\n`;
    });
    
    await ctx.reply(positionsList, { parse_mode: 'Markdown' });
  } catch (error) {
    await ctx.reply(`❌ Unable to fetch positions: ${error.message}`);
  }
});

// Close positions command
bot.command('close', async (ctx) => {
  try {
    const positions = await asterAPI.getPositions();
    
    if (positions.length === 0) {
      return ctx.reply('No open positions to close.');
    }
    
    const keyboard = positions.map(pos => 
      [Markup.button.callback(`${pos.symbol} (${pos.size})`, `close_${pos.id}`)]
    );
    
    await ctx.reply(
      '🔒 **Close Position**\n\nSelect position to close:',
      Markup.inlineKeyboard(keyboard)
    );
  } catch (error) {
    await ctx.reply(`❌ Unable to fetch positions: ${error.message}`);
  }
});

// Handle callback queries for interactive flows
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const userId = ctx.from.id;
  const session = userSessions.get(userId);
  
  try {
    if (data.startsWith('select_asset_')) {
      const symbol = data.replace('select_asset_', '');
      session.tradingFlow.asset = symbol;
      session.tradingFlow.step = 'enter_size';
      userSessions.set(userId, session);
      
      await ctx.answerCbQuery();
      await ctx.editMessageText(
        `Selected: ${symbol}\n\nEnter position size (in USDT):\nExample: 100`
      );
    }
    
    if (data.startsWith('close_')) {
      const positionId = data.replace('close_', '');
      await asterAPI.closePosition(positionId);
      
      await ctx.answerCbQuery();
      await ctx.editMessageText('✅ Position closed successfully!');
    }
    
    // Handle leverage selection
    if (data.startsWith('leverage_') && session?.tradingFlow?.step === 'enter_leverage') {
      const leverage = parseInt(data.replace('leverage_', ''));
      session.tradingFlow.leverage = leverage;
      session.tradingFlow.step = 'confirm';
      userSessions.set(userId, session);
      
      const { type, asset, size } = session.tradingFlow;
      const side = type === 'long' ? 'Long' : 'Short';
      
      const confirmKeyboard = [
        [Markup.button.callback('✅ Confirm Trade', 'confirm_trade')],
        [Markup.button.callback('❌ Cancel', 'cancel_trade')]
      ];
      
      await ctx.answerCbQuery();
      await ctx.editMessageText(
        `📋 **Trade Confirmation:**\n\n` +
        `Asset: ${asset}\n` +
        `Side: ${side}\n` +
        `Size: ${size} USDT\n` +
        `Leverage: ${leverage}x\n\n` +
        `Confirm this trade?`,
        Markup.inlineKeyboard(confirmKeyboard)
      );
    }
    
    if (data === 'confirm_trade' && session?.tradingFlow?.step === 'confirm') {
      const { type, asset, size, leverage } = session.tradingFlow;
      
      const result = await asterAPI.placeOrder({
        symbol: asset,
        side: type,
        size: size,
        leverage: leverage
      });
      
      session.tradingFlow = null;
      userSessions.set(userId, session);
      
      await ctx.answerCbQuery();
      await ctx.editMessageText(
        `✅ **Trade Executed!**\n\n` +
        `Order ID: ${result.orderId}\n` +
        `Asset: ${asset}\n` +
        `Side: ${type}\n` +
        `Size: ${size} USDT\n` +
        `Leverage: ${leverage}x`
      );
    }
    
    if (data === 'cancel_trade') {
      session.tradingFlow = null;
      userSessions.set(userId, session);
      
      await ctx.answerCbQuery();
      await ctx.editMessageText('❌ Trade cancelled.');
    }
  } catch (error) {
    await ctx.answerCbQuery();
    await ctx.reply(`Error: ${error.message}`);
  }
});

// Handle text messages for position size input
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const session = userSessions.get(userId);

  if (session?.tradingFlow?.step === 'enter_size') {
      try {
          const size = parseFloat(ctx.message.text);
          if (isNaN(size) || size <= 0) {
              return ctx.reply('Invalid size. Please enter a positive number.');
          }

          session.tradingFlow.size = size;
          session.tradingFlow.step = 'enter_leverage';
          userSessions.set(userId, session);

          const symbol = session.tradingFlow.asset;
          await ctx.reply(`Fetching leverage options for ${symbol}...`);

          // 1. Get the asset-specific max leverage using the new function
          const maxLeverage = await asterAPI.getLeverageBrackets(symbol);

          // 2. Define all possible leverage steps
          const allLeverageSteps = [2, 5, 10, 20, 25, 50, 75, 100, 125];

          // 3. Filter to show only valid options for this asset
          const validLeverageOptions = allLeverageSteps.filter(step => step <= maxLeverage);
          
          // 4. Dynamically create the keyboard
          const leverageKeyboard = [];
          for (let i = 0; i < validLeverageOptions.length; i += 3) {
              leverageKeyboard.push(
                  validLeverageOptions.slice(i, i + 3).map(leverage => 
                      Markup.button.callback(`${leverage}x`, `leverage_${leverage}`)
                  )
              );
          }
          
          await ctx.reply(
              `Size: ${size} USDT\nMax Leverage for ${symbol}: **${maxLeverage}x**\n\nSelect your leverage:`,
              {
                  parse_mode: 'Markdown',
                  ...Markup.inlineKeyboard(leverageKeyboard)
              }
          );
      } catch (error) {
          session.tradingFlow = null; // Reset flow on error
          userSessions.set(userId, session);
          await ctx.reply(`❌ Error: ${error.message}`);
      }
  }
});


// Error handling
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  
  // Send bot.onuser-friendly error message
  let errorMessage = '❌ An unexpected error occurred. Please try again.';
  
  if (err.message.includes('Insufficient margin')) {
    errorMessage = '💰 Insufficient margin. Please deposit more funds to your trading account using /deposit';
  } else if (err.message.includes('Invalid API signature')) {
    errorMessage = '🔑 API authentication failed. Please check your API credentials in the .env file';
  } else if (err.message.includes('Connection error')) {
    errorMessage = '🌐 Connection error. Please check your internet connection and try again';
  } else if (err.message.includes('Trading pair')) {
    errorMessage = '📈 ' + err.message;
  } else if (err.message.includes('Unable to')) {
    errorMessage = '⚠️ ' + err.message;
  }
  
  ctx.reply(errorMessage);
});

// Launch bot
bot.launch().then(() => {
  console.log('🚀 AsterDex BNB Trading Bot started!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));