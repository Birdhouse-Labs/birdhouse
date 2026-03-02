// ABOUTME: React hooks migration diff sample
// ABOUTME: Shows conversion from class component to hooks

import type { DiffSample } from "./types";

export const reactHooks: DiffSample = {
  id: "react-hooks",
  name: "React Hooks Migration",
  filePath: "UserProfile.tsx",
  description: "Convert class component to functional component with hooks",
  before: `import React from 'react';

interface User {
  name: string;
  email: string;
}

interface UserProfileProps {
  userId: string;
}

interface UserProfileState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

class UserProfile extends React.Component<UserProfileProps, UserProfileState> {
  constructor(props: UserProfileProps) {
    super(props);
    this.state = {
      user: null,
      loading: true,
      error: null,
    };
  }

  async componentDidMount() {
    await this.fetchUser();
  }

  async componentDidUpdate(prevProps: UserProfileProps) {
    if (prevProps.userId !== this.props.userId) {
      await this.fetchUser();
    }
  }

  async fetchUser() {
    this.setState({ loading: true, error: null });
    try {
      const response = await fetch(\`/api/users/\${this.props.userId}\`);
      const user = await response.json();
      this.setState({ user, loading: false });
    } catch (error) {
      this.setState({ error: 'Failed to load user', loading: false });
    }
  }

  render() {
    const { user, loading, error } = this.state;

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
    if (!user) return null;

    return (
      <div>
        <h1>{user.name}</h1>
        <p>{user.email}</p>
      </div>
    );
  }
}

export default UserProfile;`,
  after: `import React, { useEffect, useState } from 'react';

interface User {
  name: string;
  email: string;
}

interface UserProfileProps {
  userId: string;
}

const UserProfile: React.FC<UserProfileProps> = ({ userId }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(\`/api/users/\${userId}\`);
        const userData = await response.json();
        setUser(userData);
      } catch (err) {
        setError('Failed to load user');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [userId]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user) return null;

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
};

export default UserProfile;`,
};
