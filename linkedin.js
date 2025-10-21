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

    await page.waitForSelector('input[name="session_key"]', { timeout: 10000 });

    // Check if manual login is needed (if no credentials provided)
    if (!process.env.LINKEDIN_USERNAME || !process.env.LINKEDIN_PASSWORD) {
      console.log('⚠️ No credentials found in .env file');
      console.log('⏳ Please login manually. Waiting 60 seconds...');
      await sleep(60000);
      return true;
    }

    console.log('🔑 Attempting automatic login...');
    await page.type('input[name="session_key"]', process.env.LINKEDIN_USERNAME, { 
      delay: randomDelay(150, 250) 
    });
    await sleep(randomDelay(1000, 2000));
    
    await page.type('input[name="session_password"]', process.env.LINKEDIN_PASSWORD, { 
      delay: randomDelay(150, 250) 
    });
    await sleep(randomDelay(1000, 2000));

    await page.keyboard.press("Enter");
    
    console.log('⏳ Waiting for navigation... If CAPTCHA appears, please solve it manually.');
    console.log('⏳ Waiting up to 60 seconds for login completion...');
    
    try {
      await page.waitForNavigation({ 
        waitUntil: "networkidle2", 
        timeout: 60000 
      });
      console.log('✅ Login successful!');
    } catch (navError) {
      if (navError.message.includes("Navigation timeout") || navError.message.includes("Timeout")) {
        console.log("⚠️ Navigation timeout - assuming login success, proceeding...");
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

// Like a post using the improved selector from your HTML
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

// Comment on a specific post with improved selector
async function commentOnSpecificPost(post, commentText = "Interested") {
  try {
    // Find comment button using aria-label
    const commentButton = await post.$('button[aria-label*="Comment"]');
    
    if (!commentButton) {
      console.log('❌ Comment button not found in post');
      return false;
    }

    await commentButton.click();
    console.log('💬 Opened comment box');
    await sleep(randomDelay(3000, 4000));

    // Wait for the comment editor to appear
    const commentBox = await post.$('div.ql-editor[contenteditable="true"]');
    
    if (!commentBox) {
      console.log('❌ Comment box not found in post');
      return false;
    }

    await commentBox.click();
    await sleep(randomDelay(1000, 1500));

    // Type comment with human-like delays
    await commentBox.type(commentText, { delay: randomDelay(100, 200) });
    console.log(`💬 Typed comment: "${commentText}"`);

    await sleep(randomDelay(2000, 3000));

    // Find and click the submit button
    const postButton = await post.$('button.comments-comment-box__submit-button');
    
    if (!postButton) {
      console.log('❌ Comment submit button not found in post');
      return false;
    }

    // Check if button is enabled
    const isEnabled = await postButton.evaluate(el => !el.disabled);
    
    if (!isEnabled) {
      console.log('⚠️ Submit button is disabled, skipping...');
      return false;
    }

    await postButton.click();
    console.log('📤 Comment submitted successfully!');
    await sleep(randomDelay(3000, 5000));
    return true;
  } catch (error) {
    console.error('❌ Error commenting on post:', error.message);
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

    // Step 1: Login (with manual intervention support)
    const loggedIn = await linkedInLogin(page);
    if (!loggedIn) {
      console.log('❌ Login failed. Exiting...');
      await browser.close();
      return;
    }

    // Navigate to LinkedIn feed
    console.log('🏠 Navigating to LinkedIn feed...');
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

    console.log(`\n🤖 Starting automation - processing up to ${maxPosts} posts...\n`);

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

      console.log(`\n--- Processing Post ${postsProcessed + 1}/${maxPosts} ---`);

      // Scroll post into view
      await post.evaluate(el => el.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      }));
      await sleep(randomDelay(2500, 3500));

      // Try to like the post
      const liked = await likePost(post);
      if (liked) likesCount++;

      // Random delay between like and comment
      await sleep(randomDelay(2000, 3000));

      // Try to comment on the post
      const commented = await commentOnSpecificPost(post, "Interested");
      if (commented) commentsCount++;

      postsProcessed++;

      // Scroll to load next post
      await scrollOnce(page);
      
      // Longer delay between posts to appear more human
      await sleep(randomDelay(5000, 8000));
    }

    console.log('\n========================================');
    console.log('✅ Automation completed successfully!');
    console.log(`📊 Stats:`);
    console.log(`   - Posts processed: ${postsProcessed}`);
    console.log(`   - Likes given: ${likesCount}`);
    console.log(`   - Comments posted: ${commentsCount}`);
    console.log('========================================\n');

    console.log('⏳ Browser will remain open for 10 seconds...');
    await sleep(10000);

    // Uncomment to close browser automatically
    // await browser.close();
    
  } catch (err) {
    console.error('❌ Unexpected automation error:', err);
  }
}

// Start the automation
linkedInAutomation();
