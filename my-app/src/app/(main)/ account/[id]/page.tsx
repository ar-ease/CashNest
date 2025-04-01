import React from "react";

const AccountsPage = ({ params }: { params: { slug: string } }) => {
  return (
    <div>
      <h1>Accounts Page</h1>
      <p>Slug: {params.slug}</p>
    </div>
  );
};

export default AccountsPage;
