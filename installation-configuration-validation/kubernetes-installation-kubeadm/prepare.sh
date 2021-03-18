echo "DNS=8.8.8.8" >> /etc/systemd/resolved.conf
systemctl restart systemd-networkd systemd-resolved
sleep 3
sed -i 's/127.0.0.53/'8.8.8.8'/g' /etc/resolv.conf
echo "updated nameserver"
sleep 3
echo "adding google Linux Package Signing Keys"
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
