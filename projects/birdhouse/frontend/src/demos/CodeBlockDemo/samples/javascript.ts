// ABOUTME: JavaScript code sample for syntax highlighting demo
// ABOUTME: Demonstrates the evolution from callback hell to async/await

import type { CodeSample } from "./types";

export const javascript: CodeSample = {
  id: "javascript",
  name: "JavaScript",
  language: "javascript",
  description: "A journey through time: callbacks, promises, and async/await",
  code: `// The Evolution of Asynchronous JavaScript: A Developer's Journey

// Phase 1: THE DARK AGES (circa 2010)
// Welcome to callback hell - where dreams go to nest infinitely

function fetchUserTheHardWay(userId, callback) {
  setTimeout(() => {
    console.log('📡 Fetching user...');
    const user = { id: userId, name: 'Bob', teamId: 42 };
    
    // Oh no, now we need the team...
    setTimeout(() => {
      console.log('📡 Fetching team...');
      const team = { id: 42, name: 'The Debuggers', projectId: 99 };
      
      // Oh no, now we need the project...
      setTimeout(() => {
        console.log('📡 Fetching project...');
        const project = { id: 99, name: 'Escape Callback Hell' };
        
        // Oh no, now we need the project stats...
        setTimeout(() => {
          console.log('📡 Fetching project stats...');
          const stats = { bugs: 999, coffee: 'infinite' };
          
          // We made it! Only took 4 levels of nesting 🙃
          callback(null, { user, team, project, stats });
        }, 100);
      }, 100);
    }, 100);
  }, 100);
}

// Phase 2: THE ENLIGHTENMENT (circa 2015)
// Promises! We have promises! We can chain! We are free!

function fetchUser(userId) {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('📡 Fetching user with promises...');
      resolve({ id: userId, name: 'Bob', teamId: 42 });
    }, 100);
  });
}

function fetchTeam(teamId) {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('📡 Fetching team with promises...');
      resolve({ id: teamId, name: 'The Debuggers', projectId: 99 });
    }, 100);
  });
}

function fetchProject(projectId) {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('📡 Fetching project with promises...');
      resolve({ id: projectId, name: 'Escape Callback Hell' });
    }, 100);
  });
}

function fetchStats(projectId) {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('📡 Fetching stats with promises...');
      resolve({ bugs: 999, coffee: 'infinite' });
    }, 100);
  });
}

// Look at this beautiful promise chain! So much better!
// (Still kind of a pain though...)
fetchUser(1)
  .then(user => fetchTeam(user.teamId).then(team => ({ user, team })))
  .then(({ user, team }) => 
    fetchProject(team.projectId).then(project => ({ user, team, project }))
  )
  .then(({ user, team, project }) =>
    fetchStats(project.id).then(stats => ({ user, team, project, stats }))
  )
  .then(result => console.log('✅ Got everything!', result))
  .catch(err => console.error('💥 Something went wrong:', err));

// Phase 3: PEAK CIVILIZATION (circa 2017)
// async/await arrives! Code that reads like it's synchronous!
// This is what heaven looks like.

async function fetchEverythingTheBestWay(userId) {
  try {
    console.log('🚀 Starting the elegant way...');
    
    const user = await fetchUser(userId);
    const team = await fetchTeam(user.teamId);
    const project = await fetchProject(team.projectId);
    const stats = await fetchStats(project.id);
    
    console.log('✅ Got everything the beautiful way!');
    return { user, team, project, stats };
  } catch (error) {
    console.error('💥 Error in paradise:', error);
    throw error;
  }
}

// Bonus: Parallel fetching (because we're not animals)
async function fetchMultipleUsersInParallel(userIds) {
  const userPromises = userIds.map(id => fetchUser(id));
  const users = await Promise.all(userPromises);
  console.log(\`✨ Fetched \${users.length} users in parallel!\`);
  return users;
}

// Run the evolution
console.log('=== THE CALLBACK ERA ===');
fetchUserTheHardWay(1, (err, data) => {
  if (err) return console.error(err);
  console.log('Old school result:', data);
});

console.log('\\n=== THE PROMISE ERA ===');
// (promise chain above)

console.log('\\n=== THE ASYNC/AWAIT ERA ===');
fetchEverythingTheBestWay(1).then(result => {
  console.log('Modern result:', result);
});

console.log('\\n=== THE PARALLEL ERA ===');
fetchMultipleUsersInParallel([1, 2, 3]);`,
};
