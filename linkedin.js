import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Login function with manual intervention option
async function linkedInLogin(page) {
  try {
    console.log('🔐 Navigating to LinkedIn login page...');
    await page.goto("https://www.linkedin.com/login", { 
      waitUntil: "networkidle2",
      timeout: 60000 
    });

    // Wait for login form
    await page.locator('input[name="session_key"]').wait();

    // Check if manual login is needed
    if (!process.env.LINKEDIN_USERNAME || !process.env.LINKEDIN_PASSWORD) {
      console.log('⚠️ No credentials found in .env file');
      console.log('⏳ Please login manually (including CAPTCHA/2FA). Waiting 60 seconds...');
      await sleep(60000);
      return true;
    }

    console.log('🔑 Attempting automatic login...');
    
    // Fill username using locator
    await page.locator('input[name="session_key"]').fill(process.env.LINKEDIN_USERNAME);
    await sleep(randomDelay(1000, 2000));
    
    // Fill password using locator
    await page.locator('input[name="session_password"]').fill(process.env.LINKEDIN_PASSWORD);
    await sleep(randomDelay(1000, 2000));

    // Click login button
    await page.locator('button[type="submit"]').click();
    
    console.log('⏳ Waiting for navigation... If CAPTCHA appears, solve it manually.');
    console.log('⏳ Waiting up to 60 seconds for login completion...');
    
    try {
      await page.waitForNavigation({ 
        waitUntil: "networkidle2", 
        timeout: 60000 
      });
      console.log('✅ Login successful!');
    } catch (navError) {
      if (navError.message.includes("Navigation timeout") || navError.message.includes("Timeout")) {
        console.log("⚠️ Navigation timeout - assuming login success...");
      } else {
        throw navError;
      }
    }

    await sleep(3000);
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    return false;
  }
}

// Scroll down smoothly
async function scrollOnce(page) {
  console.log('🐭 Scrolling down...');
  await page.evaluate(() => {
    window.scrollBy({ top: 800, behavior: 'smooth' });
  });
  await sleep(randomDelay(3000, 4500));
}

// Like a post using modern locator API
async function likePost(post) {
  try {
    // First check if already liked by looking for aria-pressed="true"
    const likeButton = await post.$('button[aria-label*="React Like"]');
    
    if (!likeButton) {
      console.log('❌ Like button not found in post');
      return false;
    }

    const isLiked = await likeButton.evaluate(el => el.getAttribute('aria-pressed') === 'true');

    if (isLiked) {
      console.log('⚠️ Post already liked, skipping...');
      return false;
    }

    await likeButton.click();
    console.log('👍 Post liked!');
    await sleep(randomDelay(2000, 4000));
    return true;
  } catch (error) {
    console.error('❌ Error liking post:', error.message);
    return false;
  }
}

// Comment on a specific post using modern locator API
async function commentOnSpecificPost(post, page, commentText = "Interested") {
  try {
    console.log('💬 Attempting to comment on post...');
    
    // Step 1: Click the comment button using locator with text selector
    const commentButton = await post.$('button[aria-label*="Comment"]');
    if (!commentButton) {
      console.log('❌ Comment button not found');
      return false;
    }
    
    await commentButton.click();
    console.log('✅ Comment box opened');
    await sleep(randomDelay(3500, 4500));

    // Step 2: Wait for and type in the comment editor using locator
    console.log('⌨️ Finding comment editor...');
    
    // Wait for comment box to appear
    await page.locator('div.ql-editor[contenteditable="true"]').wait({ timeout: 10000 });
    
    const commentBox = await post.$('div.ql-editor[contenteditable="true"]');
    if (!commentBox) {
      console.log('❌ Comment box not found');
      return false;
    }

    await commentBox.click();
    await sleep(randomDelay(1000, 1500));

    // Type comment with human-like delays
    console.log(`⌨️ Typing comment: "${commentText}"`);
    await commentBox.type(commentText, { delay: randomDelay(100, 200) });
    await sleep(randomDelay(2500, 3500));

    // Step 3: Find and click submit button using multiple strategies
    console.log('🔍 Searching for submit button...');
    
    let submitButton = null;
    
    // Strategy 1: Use locator with text selector (most reliable with modern API)
    try {
      const textLocator = page.locator('button ::-p-text(Comment)');
      
      // Filter to find the button within the current post
      const buttons = await post.$$('button');
      for (const button of buttons) {
        const text = await button.evaluate(el => el.textContent.trim());
        const hasClass = await button.evaluate(el => 
          el.className.includes('submit-button') || 
          el.className.includes('artdeco-button--primary')
        );
        
        if (text === 'Comment' && hasClass) {
          submitButton = button;
          console.log('✅ Found submit button via text and class match');
          break;
        }
      }
    } catch (e) {
      console.log('⚠️ Text locator strategy failed, trying alternatives...');
    }

    // Strategy 2: Try class-based selector
    if (!submitButton) {
      submitButton = await post.$('button.comments-comment-box__submit-button--cr');
      if (submitButton) {
        console.log('✅ Found submit button via class selector');
      }
    }

    // Strategy 3: Try primary button class
    if (!submitButton) {
      const primaryButtons = await post.$$('button.artdeco-button--primary');
      for (const button of primaryButtons) {
        const text = await button.evaluate(el => el.textContent.trim());
        if (text === 'Comment' || text === 'Post') {
          submitButton = button;
          console.log('✅ Found submit button via primary button class');
          break;
        }
      }
    }

    if (!submitButton) {
      console.log('❌ Submit button not found after trying all strategies');
      return false;
    }

    // Wait for button to be enabled
    console.log('⏳ Waiting for submit button to be enabled...');
    try {
      await page.waitForFunction(
        (btn) => !btn.disabled && btn.offsetParent !== null,
        { timeout: 8000 },
        submitButton
      );
    } catch (e) {
      console.log('⚠️ Button enable check timeout, attempting click anyway...');
    }

    // Check if enabled before clicking
    const isEnabled = await submitButton.evaluate(el => !el.disabled);
    if (!isEnabled) {
      console.log('⚠️ Submit button is disabled, skipping...');
      return false;
    }

    // Click the submit button
    console.log('🖱️ Clicking submit button...');
    await submitButton.click();
    console.log('✅ Comment posted successfully!');
    
    await sleep(randomDelay(3000, 5000));
    return true;
    
  } catch (error) {
    console.error('❌ Error commenting on post:', error.message);
    console.error('Error details:', error.stack);
    return false;
  }
}

// Main automation flow
async function linkedInAutomation() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: [
      "--start-maximized", 
      "--no-sandbox", 
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled"
    ],
  });

  try {
    const page = (await browser.pages())[0];
    page.setDefaultNavigationTimeout(60000);

    // Set realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    console.log('\n🚀 Starting LinkedIn Automation with Modern Locator API\n');
    console.log('=' .repeat(60));

    // Step 1: Login
    const loggedIn = await linkedInLogin(page);
    if (!loggedIn) {
      console.log('❌ Login failed. Exiting...');
      await browser.close();
      return;
    }

    // Navigate to LinkedIn feed
    console.log('\n🏠 Navigating to LinkedIn feed...');
    try {
      await page.goto('https://www.linkedin.com/feed/', { 
        waitUntil: 'networkidle2', 
        timeout: 60000 
      });
    } catch (error) {
      if (error.message.includes('Navigation timeout') || error.message.includes('Timeout')) {
        console.log('⚠️ Navigation timeout loading feed, continuing anyway...');
      } else {
        throw error;
      }
    }
    
    console.log('✅ Feed loaded successfully!');
    await sleep(5000);

    const maxPosts = 10; // Limit to avoid detection
    let postsProcessed = 0;
    let likesCount = 0;
    let commentsCount = 0;

    console.log('\n' + '='.repeat(60));
    console.log(`🤖 Starting post processing - Up to ${maxPosts} posts`);
    console.log('='.repeat(60) + '\n');

    while (postsProcessed < maxPosts) {
      // Get all posts currently visible
      const posts = await page.$$('div.feed-shared-update-v2');
      
      if (posts.length === 0) {
        console.log('❌ No posts found on feed');
        break;
      }

      const post = posts[postsProcessed];
      
      if (!post) {
        console.log('⚠️ No more new posts to process');
        break;
      }

      console.log('\n' + '-'.repeat(60));
      console.log(`📝 Processing Post ${postsProcessed + 1}/${maxPosts}`);
      console.log('-'.repeat(60));

      // Scroll post into view smoothly
      await post.evaluate(el => el.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      }));
      await sleep(randomDelay(2500, 3500));

      // Try to like the post
      const liked = await likePost(post, page);
      if (liked) likesCount++;

      // Random delay between like and comment
      await sleep(randomDelay(2000, 3500));

      // Try to comment on the post
      const commented = await commentOnSpecificPost(post, page, "Interested");
      if (commented) commentsCount++;

      postsProcessed++;

      // Scroll to load next post
      await scrollOnce(page);
      
      // Longer delay between posts to appear human-like
      console.log(`⏳ Pausing before next post...`);
      await sleep(randomDelay(6000, 10000));
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ AUTOMATION COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\n📊 Final Statistics:');
    console.log(`   • Posts Processed: ${postsProcessed}/${maxPosts}`);
    console.log(`   • Likes Given: ${likesCount}`);
    console.log(`   • Comments Posted: ${commentsCount}`);
    console.log(`   • Success Rate: ${Math.round(((likesCount + commentsCount) / (postsProcessed * 2)) * 100)}%`);
    console.log('\n' + '='.repeat(60));

    console.log('\n⏳ Browser will remain open for 15 seconds...');
    await sleep(15000);

    console.log('👋 Closing browser...');
    // Uncomment to close browser automatically
    // await browser.close();
    
  } catch (err) {
    console.error('\n❌ CRITICAL ERROR:');
    console.error('=' .repeat(60));
    console.error('Error message:', err.message);
    console.error('Stack trace:', err.stack);
    console.error('='.repeat(60));
  }
}

// Start the automation
console.log('\n🎯 LinkedIn Automation Bot - Modern Locator API');
console.log('⚠️  Educational purposes only - violates LinkedIn ToS');
console.log('='.repeat(60) + '\n');

linkedInAutomation();
